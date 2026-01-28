"use client";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

/**
 * ADVANCED MATH: Vector Angle Calculation
 * Uses the Dot Product to find the angle at the knee.
 */
const calculateAngle = (p1: any, p2: any, p3: any) => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const angle = Math.acos(dotProduct / (mag1 * mag2));
    return (angle * 180) / Math.PI;
};

const GymInstructor = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isLoaded, setIsLoaded] = useState(false);
    const [count, setCount] = useState(0);
    const [stage, setStage] = useState("up");
    const [feedback, setFeedback] = useState("Initializing...");
    const [liveAngle, setLiveAngle] = useState(0);

    useEffect(() => {
        const loadMediaPipe = async () => {
            const poseModule = await import("@mediapipe/pose");
            const drawingModule = await import("@mediapipe/drawing_utils");
            const Pose = poseModule.Pose;
            const { drawConnectors, drawLandmarks } = drawingModule;

            const pose = new Pose({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
            });

            pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6,
            });

            pose.onResults((results) => {
                if (!canvasRef.current || !webcamRef.current?.video) return;
                const video = webcamRef.current.video;
                const canvas = canvasRef.current;
                const canvasCtx = canvas.getContext("2d");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                if (canvasCtx && results.poseLandmarks) {
                    canvasCtx.save();
                    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw Skeleton
                    drawConnectors(canvasCtx, results.poseLandmarks, [[24, 26], [26, 28]], { color: "#00FF00", lineWidth: 5 });
                    drawLandmarks(canvasCtx, results.poseLandmarks, { color: "#FF0000", radius: 3 });

                    const landmarks = results.poseLandmarks;
                    const hip = landmarks[24];   
                    const knee = landmarks[26];  
                    const ankle = landmarks[28]; 

                    // --- RE-WRITTEN SAFETY GUARD FOR TYPESCRIPT ---
                    // This explicitly checks for existence before checking visibility
                    if (hip && knee && ankle && 
                        hip.visibility !== undefined && 
                        knee.visibility !== undefined && 
                        ankle.visibility !== undefined) {
                        
                        if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
                            const angle = calculateAngle(hip, knee, ankle);
                            setLiveAngle(Math.round(angle));

                            // SQUAT LOGIC
                            if (angle < 100) {
                                if (stage !== "down") {
                                    setStage("down");
                                    setFeedback("LOW! Now Push Up!");
                                }
                            }
                            
                            if (angle > 160 && stage === "down") {
                                setStage("up");
                                setCount((prev) => prev + 1);
                                setFeedback("Great Rep!");
                            }
                        } else {
                            setFeedback("Visibility low. Fix lighting.");
                        }
                    } else {
                        setFeedback("Body hidden! Step back.");
                    }
                    canvasCtx.restore();
                }
            });

            const runDetection = async () => {
                if (webcamRef.current?.video?.readyState === 4) {
                    await pose.send({ image: webcamRef.current.video });
                }
                requestAnimationFrame(runDetection);
            };
            runDetection();
            setIsLoaded(true);
        };
        loadMediaPipe();
    }, [stage]);

    return (
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen bg-slate-950 p-6 gap-8 text-white font-sans">
            <div className="relative border-8 border-slate-800 rounded-3xl overflow-hidden bg-black shadow-2xl">
                {!isLoaded && (
                   <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 text-blue-400 font-bold">
                     Loading AI...
                   </div>
                )}
                <Webcam ref={webcamRef} mirrored={true} className="w-full max-w-3xl" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full" />
                <div className="absolute top-4 left-4 bg-blue-600 px-4 py-2 rounded-lg font-mono text-xl">
                    Angle: {liveAngle}°
                </div>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-4">
                <div className="bg-slate-900 p-10 rounded-3xl text-center border border-slate-700">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Squat Count</p>
                    <h1 className="text-9xl font-black text-blue-500">{count}</h1>
                    <p className="text-xs text-slate-600">POSITION: {stage.toUpperCase()}</p>
                </div>
                <div className={`p-6 rounded-2xl text-center font-bold text-xl uppercase ${stage === "down" ? "bg-green-600" : "bg-blue-800"}`}>
                    {feedback}
                </div>
                <button onClick={() => setCount(0)} className="py-4 bg-slate-800 rounded-xl font-bold hover:bg-red-900 transition-colors">
                    RESET SESSION
                </button>
            </div>
        </div>
    );
};

export default GymInstructor;