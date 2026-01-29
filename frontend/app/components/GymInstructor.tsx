"use client";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

/**
 * TEACHER'S NOTE: 
 * We use a simpler 2D Angle math here. 
 * By using only X and Y, we avoid the "jitter" caused by the AI guessing depth.
 */
const getAngle2D = (p1: any, p2: any, p3: any) => {
    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let result = Math.abs((angle * 180) / Math.PI);
    if (result > 180) result = 360 - result;
    return result;
};

const GymInstructor = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [count, setCount] = useState(0);
    const [stage, setStage] = useState("up"); // "up" or "down"
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
                smoothLandmarks: true, // This helps stop the "jitter"
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
                    
                    // Only draw the parts we need (Hip to Ankle)
                    drawConnectors(canvasCtx, results.poseLandmarks, [[24, 26], [26, 28]], { color: "#00FF00", lineWidth: 5 });
                    drawLandmarks(canvasCtx, results.poseLandmarks, { color: "#FF0000", radius: 2 });

                    const landmarks = results.poseLandmarks;
                    const hip = landmarks[24];   
                    const knee = landmarks[26];  
                    const ankle = landmarks[28]; 

                    // Check if AI is sure it sees you
                    if (hip && knee && ankle && hip.visibility! > 0.5) {
                        const angle = getAngle2D(hip, knee, ankle);
                        setLiveAngle(Math.round(angle));

                        /**
                         * STAGE LOGIC: 
                         * To stop over-counting, we require a BIG movement.
                         * 1. You MUST go below 110 degrees to set stage to "down".
                         * 2. You MUST go above 160 degrees while in "down" to get a point.
                         */
                        if (angle < 110) {
                            if (stage !== "down") {
                                setStage("down");
                            }
                        }
                        
                        if (angle > 160 && stage === "down") {
                            setStage("up");
                            setCount((c) => c + 1);
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
    }, [stage]);

    return (
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen bg-slate-950 p-4 gap-6 text-white overflow-hidden">
            {/* Camera View */}
            <div className="relative border-4 border-slate-700 rounded-2xl overflow-hidden bg-black shadow-lg">
                <Webcam ref={webcamRef} mirrored={true} className="w-full max-w-2xl h-auto" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-auto" />
                <div className="absolute top-4 left-4 bg-blue-600/80 px-3 py-1 rounded text-lg font-mono">
                    Angle: {liveAngle}°
                </div>
            </div>

            {/* Dashboard */}
            <div className="w-full max-w-xs flex flex-col gap-4">
                <div className="bg-slate-900 p-6 rounded-2xl text-center border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Squat Reps</p>
                    <h1 className="text-8xl font-black text-blue-500">{count}</h1>
                    <p className="text-[10px] text-slate-600 mt-2 font-mono">STATUS: {stage.toUpperCase()}</p>
                </div>
                
                <div className={`p-4 rounded-xl text-center font-bold uppercase border-b-4 ${stage === "down" ? "bg-green-600 border-green-800" : "bg-blue-800 border-blue-950"}`}>
                    {stage === "down" ? "Stand Up!" : "Squat Down!"}
                </div>

                <button onClick={() => setCount(0)} className="py-3 bg-slate-800 rounded-xl font-bold hover:bg-red-900 transition-colors text-sm">
                    RESET SESSION
                </button>
            </div>
        </div>
    );
};

export default GymInstructor;