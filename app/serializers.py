from datetime import date
from django.conf import settings
from django.contrib.auth import authenticate
from django.db.models import Avg
from rest_framework import serializers
from .models import User, Room, Booking, Review, Message


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'contact_number', 'bio', 'profile_picture', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'is_staff', 'is_superuser']


class TenantBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'contact_number']


class LandlordBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'contact_number']


class SignupSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)
    admin_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'password2',
            'role',
            'contact_number',
            'bio',
            'profile_picture',
            'admin_code',
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError('Passwords must match.')

        if attrs.get('role') == 'admin':
            admin_code = attrs.get('admin_code')
            if admin_code != getattr(settings, 'ADMIN_SIGNUP_CODE', 'ADMIN123'):
                raise serializers.ValidationError('Invalid admin signup code.')

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2', None)
        validated_data.pop('admin_code', None)

        password = validated_data.pop('password')
        role = validated_data.pop('role', 'tenant')
        username = validated_data.pop('username')
        email = validated_data.pop('email', '')

        is_staff = False
        is_superuser = False
        if role == 'admin':
            is_staff = True
            is_superuser = True

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            is_staff=is_staff,
            is_superuser=is_superuser,
            **validated_data,
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    token = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        email = attrs.get('email')
        password = attrs.get('password')

        if not username and not email:
            raise serializers.ValidationError('Provide username or email.')

        if not username and email:
            user = User.objects.filter(email=email).first()
            if not user:
                raise serializers.ValidationError('Invalid credentials.')
            username = user.username

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError('Invalid credentials.')

        attrs['user'] = user
        return attrs


class RoomBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'description', 'location', 'city', 'state', 'availability_status']


class BookingSerializer(serializers.ModelSerializer):
    tenant = TenantBasicSerializer(read_only=True)
    room = RoomBasicSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'tenant', 'room', 'check_in', 'status', 'payment_status', 'payment_reference', 'booking_reference', 'special_requests', 'created_at']
        read_only_fields = ['id', 'tenant', 'booking_reference', 'created_at']


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['room', 'check_in', 'payment_reference', 'special_requests']

    def validate(self, attrs):
        room = attrs.get('room')
        check_in = attrs.get('check_in')
        if room and room.availability_status == 'booked':
            raise serializers.ValidationError('Room is currently booked and unavailable for new reservations.')
        if check_in and check_in < date.today():
            raise serializers.ValidationError('check_in must be today or a future date.')
        return attrs

    def create(self, validated_data, **kwargs):
        tenant = kwargs.get('tenant') or self.context['request'].user
        return Booking.objects.create(tenant=tenant, status='pending', **validated_data)


class BookingUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['status', 'payment_status']


class BookingDetailSerializer(serializers.ModelSerializer):
    tenant = TenantBasicSerializer(read_only=True)
    room = RoomBasicSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'tenant', 'room', 'check_in', 'status', 'payment_status', 'payment_reference', 'booking_reference', 'special_requests', 'created_at', 'updated_at']
        read_only_fields = ['id', 'tenant', 'booking_reference', 'created_at', 'updated_at']


class BookingStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['id', 'check_in', 'status']


class ReviewSerializer(serializers.ModelSerializer):
    tenant = TenantBasicSerializer(read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'room', 'tenant', 'rating', 'comment', 'created_at', 'updated_at']
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['room', 'rating', 'comment']

    def validate(self, attrs):
        room = attrs.get('room')
        user = self.context['request'].user

        if Review.objects.filter(room=room, tenant=user).exists():
            raise serializers.ValidationError('You have already reviewed this room.')

        if not Booking.objects.filter(room=room, tenant=user, status='confirmed').exists():
            raise serializers.ValidationError('You can only review a room after a confirmed booking.')

        return attrs

    def create(self, validated_data):
        tenant = self.context['request'].user
        return Review.objects.create(tenant=tenant, **validated_data)


class RoomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['description', 'price', 'location', 'city', 'state']

    def create(self, validated_data, **kwargs):
        landlord = kwargs.get('landlord') or self.context['request'].user
        return Room.objects.create(landlord=landlord, **validated_data)


class RoomUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['description', 'price', 'location', 'city', 'state']


class RoomListSerializer(serializers.ModelSerializer):
    landlord = LandlordBasicSerializer(read_only=True)
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'description', 'price', 'location', 'city', 'state', 'availability_status', 'landlord', 'average_rating']

    def get_average_rating(self, obj):
        avg = obj.reviews.aggregate(avg_rating=Avg('rating'))['avg_rating']
        return round(avg, 1) if avg is not None else None


class RoomDetailSerializer(serializers.ModelSerializer):
    landlord = LandlordBasicSerializer(read_only=True)
    bookings = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = '__all__'

    def get_bookings(self, obj):
        bookings = obj.bookings.all()
        if bookings.exists():
            return BookingStatusSerializer(bookings, many=True).data
        return [{'status': 'open'}]

    def get_average_rating(self, obj):
        avg = obj.reviews.aggregate(avg_rating=Avg('rating'))['avg_rating']
        return round(avg, 1) if avg is not None else None

    def get_review_count(self, obj):
        return obj.reviews.count()


class ChatUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role', 'profile_picture']


class MessageSerializer(serializers.ModelSerializer):
    sender_detail = ChatUserSerializer(source='sender', read_only=True)
    receiver_detail = ChatUserSerializer(source='receiver', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'receiver', 'room', 'content', 'is_read', 'created_at', 'sender_detail', 'receiver_detail']
        read_only_fields = ['id', 'sender', 'created_at']

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)