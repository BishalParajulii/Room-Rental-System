from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import User, Room, Booking


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'contact_number', 'bio', 'profile_picture', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'is_staff', 'is_superuser']


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


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['tenant', 'room', 'check_in', 'check_out', 'guests_count', 'special_requests']


class BookingUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['status', 'payment_status']


class BookingDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'


class RoomDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class RoomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['description', 'price', 'location', 'city', 'state']

    def create(self, validated_data):
        user = self.context['request'].user
        instance = Room(**validated_data)
        instance.landlord = user
        instance.save()
        return instance


class RoomUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['description', 'price', 'location', 'city', 'state']


class RoomListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'description', 'price', 'location', 'city', 'state']

