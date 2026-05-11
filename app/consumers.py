import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Message, User
from .serializers import MessageSerializer


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = user_chat_group(self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get('type') != 'chat.message':
            return

        receiver_id = content.get('receiver')
        message_content = (content.get('content') or '').strip()
        if not receiver_id or not message_content:
            await self.send_json({'type': 'chat.error', 'message': 'receiver and content are required.'})
            return
        if str(receiver_id) == str(self.user.id):
            await self.send_json({'type': 'chat.error', 'message': 'You cannot send messages to yourself.'})
            return

        message = await self.create_message(receiver_id, message_content, content.get('room'))
        if not message:
            await self.send_json({'type': 'chat.error', 'message': 'Receiver not found.'})
            return

        await broadcast_message(self.channel_layer, message)

    async def chat_message(self, event):
        await self.send_json({'type': 'chat.message', 'message': event['message']})

    @database_sync_to_async
    def create_message(self, receiver_id, content, room_id=None):
        if str(receiver_id) == str(self.user.id):
            return None
        if not User.objects.filter(id=receiver_id).exists():
            return None

        message = Message.objects.create(
            sender=self.user,
            receiver_id=receiver_id,
            room_id=room_id,
            content=content,
        )
        return MessageSerializer(message).data


def user_chat_group(user_id):
    return f'chat_user_{user_id}'


async def broadcast_message(channel_layer, message):
    payload = message if isinstance(message, dict) else json.loads(json.dumps(message))
    sender_id = payload['sender']
    receiver_id = payload['receiver']

    for user_id in {sender_id, receiver_id}:
        await channel_layer.group_send(
            user_chat_group(user_id),
            {
                'type': 'chat.message',
                'message': payload,
            },
        )
