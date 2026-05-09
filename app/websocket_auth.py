from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_for_token(token_key):
    if not token_key:
        return AnonymousUser()

    token = Token.objects.select_related('user').filter(key=token_key).first()
    if not token:
        return AnonymousUser()

    return token.user


class TokenAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        token_key = parse_qs(query_string).get('token', [None])[0]
        scope['user'] = await get_user_for_token(token_key)
        return await self.app(scope, receive, send)
