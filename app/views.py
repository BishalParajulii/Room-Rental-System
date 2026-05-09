from django.shortcuts import render
from django.contrib.auth import authenticate
from django.db.models import Q
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import User, Room, Booking, Payment, Review, Message
from rest_framework.generics import ListAPIView, CreateAPIView, RetrieveAPIView, UpdateAPIView, DestroyAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters import rest_framework as filters
from rest_framework.authtoken.models import Token
from .permissions import IsLandlordOrAdmin, IsTenantOrAdmin
from .serializers import (
    RoomListSerializer,
    RoomDetailSerializer,
    RoomCreateSerializer,
    RoomUpdateSerializer,
    BookingSerializer,
    BookingCreateSerializer,
    BookingUpdateSerializer,
    BookingDetailSerializer,
    ReviewSerializer,
    ReviewCreateSerializer,
    SignupSerializer,
    LoginSerializer,
    UserSerializer,
    MessageSerializer,
    ChatUserSerializer,
)
from .consumers import broadcast_message


# Create your views here.
class RoomListView(ListAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomListSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ['location', 'city', 'state', 'availability_status']
    
    
class RoomDetailView(RetrieveAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomDetailSerializer
    
class RoomCreateView(CreateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomCreateSerializer
    permission_classes = [IsAuthenticated, IsLandlordOrAdmin]

    def perform_create(self, serializer):
        serializer.save(landlord=self.request.user)


class RoomUpdateView(UpdateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomUpdateSerializer
    permission_classes = [IsAuthenticated, IsLandlordOrAdmin]

    def get_object(self):
        room = super().get_object()
        self.check_object_permissions(self.request, room)
        return room


class RoomDeleteView(DestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomDetailSerializer
    permission_classes = [IsAuthenticated, IsLandlordOrAdmin]

    def get_object(self):
        room = super().get_object()
        self.check_object_permissions(self.request, room)
        return room


class OpenRoomListView(ListAPIView):
    serializer_class = RoomListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Room.objects.filter(availability_status='open')


class BookingListView(ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or (hasattr(user, 'role') and user.role == 'admin'):
            return Booking.objects.all()
        if user.role == 'landlord':
            return Booking.objects.filter(room__landlord=user)
        return Booking.objects.filter(tenant=user)


class BookingDetailView(RetrieveAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingDetailSerializer
    permission_classes = [IsAuthenticated, IsTenantOrAdmin]


class BookingCreateView(CreateAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user)


class BookingUpdateView(UpdateAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingUpdateSerializer
    permission_classes = [IsAuthenticated] # We check object permission in logic if needed or just use both

    def get_object(self):
        obj = super().get_object()
        # Landlord of the room or the tenant who made it or admin
        user = self.request.user
        if user.is_superuser or user.role == 'admin':
            return obj
        if user.role == 'landlord' and obj.room.landlord == user:
            return obj
        if user.role == 'tenant' and obj.tenant == user:
            # Tenants can only cancel their booking
            new_status = self.request.data.get('status')
            if new_status and new_status != 'cancelled':
                self.permission_denied(self.request, message="Tenants can only cancel their own bookings.")
            return obj
        self.permission_denied(self.request)


class BookingDeleteView(DestroyAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingDetailSerializer
    permission_classes = [IsAuthenticated, IsTenantOrAdmin]


class ReviewListView(ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Review.objects.filter(room_id=self.kwargs['room_pk']).order_by('-created_at')


class ReviewCreateView(CreateAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user)


class ReviewDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated, IsTenantOrAdmin]


class SignupView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )
        

class MessageListCreateView(CreateAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(broadcast_message)(channel_layer, MessageSerializer(message).data)


class ChatHistoryView(ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        other_user_id = self.kwargs['user_id']
        return Message.objects.filter(
            (Q(sender=self.request.user) & Q(receiver_id=other_user_id)) |
            (Q(sender_id=other_user_id) & Q(receiver=self.request.user))
        ).order_by('created_at')


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get all users who have sent messages to me or received messages from me
        sent_to = Message.objects.filter(sender=user).values_list('receiver', flat=True)
        received_from = Message.objects.filter(receiver=user).values_list('sender', flat=True)
        
        user_ids = set(list(sent_to) + list(received_from))
        users = User.objects.filter(id__in=user_ids)
        serializer = ChatUserSerializer(users, many=True)
        return Response(serializer.data)



def chat_view(request):
    return render(request, 'app/chat.html')

def dashboard_view(request):
    return render(request, 'app/dashboard.html')

def login_page_view(request):
    return render(request, 'app/login.html')
