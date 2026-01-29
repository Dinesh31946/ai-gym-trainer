"use client";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

const getAngle2D = (p1: any, p2: any, p3: any) => {
    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let result = Math.abs((angle * 180) / Math.PI);
    if (result > 180) result = 360 - result;
    return result;
};

const GymInstructor = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // THE LOCKS
    const stageRef = useRef<"up" | "down">("up");
    const isProcessingRef = useRef<boolean>(false); // NEW: Stops rapid-fire counting

    const [count, setCount] = useState(0);
    const [displayStage, setDisplayStage] = useState("up");
    const [liveAngle, setLiveAngle] = useState(180);
    const [isLoaded, setIsLoaded] = useState(false);

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
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
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
                    
                    drawConnectors(canvasCtx, results.poseLandmarks, [[24, 26], [26, 28]], { color: "#00FF00", lineWidth: 5 });
                    drawLandmarks(canvasCtx, results.poseLandmarks, { color: "#FF0000", radius: 2 });

                    const landmarks = results.poseLandmarks;
                    const hip = landmarks[24];   
                    const knee = landmarks[26];  
                    const ankle = landmarks[28]; 

                    if (hip && knee && ankle && (hip.visibility ?? 0) > 0.5) {
                        const angle = getAngle2D(hip, knee, ankle);
                        setLiveAngle(Math.round(angle));

                        // 1. SQUAT DOWN: Trigger when angle drops below 100
                        if (angle < 100 && stageRef.current === "up") {
                            stageRef.current = "down";
                            setDisplayStage("down");
                        }
                        
                        // 2. STAND UP: Trigger when angle goes above 160
                        // Added isProcessingRef check to ensure we only count once
                        if (angle > 160 && stageRef.current === "down" && !isProcessingRef.current) {
                            isProcessingRef.current = true; // LOCK the counter
                            
                            stageRef.current = "up";
                            setDisplayStage("up");
                            setCount((c) => c + 1);

                            // UNLOCK after 500ms (half a second)
                            // This gives you time to fully stand up without double-counting
                            setTimeout(() => {
                                isProcessingRef.current = false;
                            }, 500);
                        }
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
    }, []);

    return (
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen bg-slate-950 p-4 gap-6 text-white overflow-hidden font-sans">
            <div className="relative border-4 border-slate-700 rounded-3xl overflow-hidden bg-black shadow-2xl">
                {!isLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
                        <p className="text-blue-400 animate-pulse font-bold">AI Loading...</p>
                    </div>
                )}
                <Webcam ref={webcamRef} mirrored={true} className="w-full max-w-2xl h-auto" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-auto" />
                <div className="absolute bottom-4 right-4 bg-blue-600/90 px-4 py-2 rounded-full font-bold text-sm">
                    Knee Angle: {liveAngle}°
                </div>
            </div>

            <div className="w-full max-w-xs flex flex-col gap-4">
                <div className="bg-slate-900 p-8 rounded-3xl text-center border border-slate-800 shadow-xl">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Squat Counter</p>
                    <h1 className="text-9xl font-black text-blue-500 drop-shadow-lg">{count}</h1>
                </div>
                
                <div className={`p-5 rounded-2xl text-center font-bold text-xl transition-colors border-b-4 ${displayStage === "down" ? "bg-green-600 border-green-800" : "bg-blue-800 border-blue-950"}`}>
                    {displayStage === "down" ? "NOW STAND UP!" : "GO LOW!"}
                </div>

                <button 
                    onClick={() => {
                        setCount(0);
                        stageRef.current = "up";
                        setDisplayStage("up");
                        isProcessingRef.current = false;
                    }} 
                    className="py-4 bg-slate-800 rounded-2xl font-bold hover:bg-red-900 transition-all text-sm border border-slate-700 active:scale-95"
                >
                    RESET SESSION
                </button>
            </div>
        </div>
    );
};

export default GymInstructor;