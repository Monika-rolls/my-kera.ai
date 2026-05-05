import sys
import os

# Add the backend root to Python path so "app" package is found
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
