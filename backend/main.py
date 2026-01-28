from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp

# Sanity Check
print(f"Running MediaPipe version: {mp.__version__}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# This is the line that was failing
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

@app.get("/")
def read_root():
    return {"message": f"AI Gym Instructor Backend is Live! (v{mp.__version__})"}

@app.post("/analyze-pose")
async def analyze_pose(data: dict):
    return {"status": "ready"}