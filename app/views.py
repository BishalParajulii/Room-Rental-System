from django.shortcuts import render
from django.contrib.auth import authenticate
from .models import User, Room, Booking, Payment, Review
from rest_framework.generics import ListAPIView, CreateAPIView, RetrieveAPIView, UpdateAPIView, DestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from .serializers import (
    RoomListSerializer,
    RoomDetailSerializer,
    RoomCreateSerializer,
    RoomUpdateSerializer,
    SignupSerializer,
    LoginSerializer,
    UserSerializer,
)


# Create your views here.
class RoomListView(ListAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomListSerializer
    
class RoomDetailView(RetrieveAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomDetailSerializer
    
class RoomCreateView(CreateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomCreateSerializer
    permission_classes = [IsAuthenticated]

class RoomUpdateView(UpdateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomUpdateSerializer
    
class RoomDeleteView(DestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomDetailSerializer



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