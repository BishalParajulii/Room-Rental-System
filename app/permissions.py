from rest_framework.permissions import BasePermission


class IsLandlordOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'landlord' or request.user.is_superuser)
        )

    def has_object_permission(self, request, view, obj):
        # Allow if user is superuser
        if request.user.is_superuser:
            return True
        
        # Check if obj is a Room
        if hasattr(obj, 'landlord'):
            return obj.landlord == request.user
            
        # Check if obj is a Booking
        if hasattr(obj, 'room'):
            return obj.room.landlord == request.user
            
        return False


class IsTenantOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user == getattr(obj, 'tenant', None) or request.user.is_superuser)
        )
