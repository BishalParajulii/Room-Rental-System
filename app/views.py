from django.shortcuts import render
from django.contrib.auth import authenticate
from .models import User, Room, Booking, Payment, Review
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
)


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
    permission_classes = [IsAuthenticated, IsTenantOrAdmin]


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


class LoginView(APIView):
    permission_classes = [AllowAny]
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
        

