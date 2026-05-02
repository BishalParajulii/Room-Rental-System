
from django.urls import path
from .views import (
    RoomListView,
    RoomDetailView,
    RoomCreateView,
    RoomUpdateView,
    RoomDeleteView,
    OpenRoomListView,
    BookingListView,
    BookingDetailView,
    BookingCreateView,
    BookingUpdateView,
    BookingDeleteView,
    SignupView,
    LoginView,
)

urlpatterns = [
    path('api/signup/', SignupView.as_view(), name='api-signup'),
    path('api/login/', LoginView.as_view(), name='api-login'),

    path('api/rooms/', RoomListView.as_view(), name='room-list'),
    path('api/rooms/open/', OpenRoomListView.as_view(), name='room-open-list'),
    path('api/rooms/create/', RoomCreateView.as_view(), name='room-create'),
    path('api/rooms/<int:pk>/', RoomDetailView.as_view(), name='room-detail'),
    path('api/rooms/<int:pk>/update/', RoomUpdateView.as_view(), name='room-update'),
    path('api/rooms/<int:pk>/delete/', RoomDeleteView.as_view(), name='room-delete'),

    path('api/bookings/', BookingListView.as_view(), name='booking-list'),
    path('api/bookings/create/', BookingCreateView.as_view(), name='booking-create'),
    path('api/bookings/<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('api/bookings/<int:pk>/update/', BookingUpdateView.as_view(), name='booking-update'),
    path('api/bookings/<int:pk>/delete/', BookingDeleteView.as_view(), name='booking-delete'),
]
