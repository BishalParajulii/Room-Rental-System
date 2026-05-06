from django.test import TestCase
from django.utils import timezone
from .models import User, Room, Booking

class BookingModelTest(TestCase):
    def setUp(self):
        # 1. Create a Landlord
        self.landlord = User.objects.create_user(
            username='landlord', 
            password='password123', 
            role='landlord'
        )
        
        # 2. Create a Tenant
        self.tenant = User.objects.create_user(
            username='tenant', 
            password='password123', 
            role='tenant'
        )
        
        # 3. Create a Room
        self.room = Room.objects.create(
            landlord=self.landlord,
            description="Luxury Studio Apartment",
            price=25000.00,
            location="Baneshwor",
            city="Kathmandu",
            state="Bagmati",
            availability_status='open'
        )

    def test_booking_creation_and_reference(self):
        """Test that a booking is created successfully and a reference is generated."""
        booking = Booking.objects.create(
            tenant=self.tenant,
            room=self.room,
            check_in=timezone.now().date(),
            status='pending'
        )
        
        self.assertTrue(booking.booking_reference)
        self.assertEqual(len(booking.booking_reference), 12)
        self.assertEqual(booking.room.availability_status, 'open') # Should stay open if pending

    def test_room_status_booked_on_confirmation(self):
        """Test that the room status changes to 'booked' when booking is confirmed."""
        booking = Booking.objects.create(
            tenant=self.tenant,
            room=self.room,
            check_in=timezone.now().date(),
            status='confirmed'
        )
        
        # We need to refresh the room object from the DB to see the changes made in Booking.save()
        self.room.refresh_from_db()
        self.assertEqual(self.room.availability_status, 'booked')

    def test_room_status_open_on_cancellation(self):
        """Test that the room status reverts to 'open' when booking is cancelled."""
        # First, create a confirmed booking
        booking = Booking.objects.create(
            tenant=self.tenant,
            room=self.room,
            check_in=timezone.now().date(),
            status='confirmed'
        )
        
        self.room.refresh_from_db()
        self.assertEqual(self.room.availability_status, 'booked')
        
        # Now, cancel it
        booking.status = 'cancelled'
        booking.save()
        
        self.room.refresh_from_db()
        self.assertEqual(self.room.availability_status, 'open')

    def test_booking_string_representation(self):
        """Test the __str__ method of the Booking model."""
        booking = Booking.objects.create(
            tenant=self.tenant,
            room=self.room,
            check_in=timezone.now().date()
        )
        expected_str = f"Booking {booking.booking_reference} for {self.tenant.username}"
        self.assertEqual(str(booking), expected_str)
