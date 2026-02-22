"""Dashboard service configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    gateway_url: str = "http://api-core:8001"
    billing_url: str = "http://billing-service:8002"
    app_name: str = "Dashboard Service"
    api_version: str = "1.0.0"
    debug: bool = False

    model_config = {"env_prefix": "DASHBOARD_"}


settings = Settings()
