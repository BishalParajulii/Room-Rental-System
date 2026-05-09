

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

django_asgi_app = get_asgi_application()

from app.routing import websocket_urlpatterns
from app.websocket_auth import TokenAuthMiddleware

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': TokenAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
