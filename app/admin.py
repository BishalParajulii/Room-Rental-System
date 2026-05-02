from django.contrib import admin
from .models import User, Room, Booking, Payment, Review

# Register your models here.

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'contact_number', 'created_at')
    list_filter = ('role', 'created_at')
    search_fields = ('username', 'email', 'contact_number')

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('description', 'price', 'location', 'city', 'state', 'availability_status', 'landlord', 'created_at')
    list_filter = ('city', 'state', 'availability_status', 'created_at')
    search_fields = ('description', 'location', 'city')

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('booking_reference', 'tenant', 'room', 'check_in', 'status', 'payment_status', 'payment_reference', 'created_at')
    list_filter = ('status', 'payment_status', 'created_at')
    search_fields = ('booking_reference', 'tenant__username', 'room__description')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('booking', 'amount', 'method', 'status', 'paid_at')
    list_filter = ('method', 'status', 'paid_at')
    search_fields = ('booking__booking_reference', 'transaction_reference')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('room', 'tenant', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('room__description', 'tenant__username', 'comment')

