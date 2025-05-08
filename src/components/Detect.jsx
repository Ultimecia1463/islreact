import React, { useState, useRef, useEffect, useCallback } from "react";
import "./Detect.css";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import {
  drawConnectors,
  drawLandmarks,
  // HAND_CONNECTIONS,
} from "@mediapipe/drawing_utils";

import { HAND_CONNECTIONS } from "@mediapipe/hands";

import Webcam from "react-webcam";
import { SignImageData } from "../data/SignImageData";
import ProgressBar from "./ProgressBar/ProgressBar";

let startTime = "";

const Detect = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const uploadedVideoRef = useRef(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureOutput, setGestureOutput] = useState("");
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [progress, setProgress] = useState(0);

  const requestRef = useRef();

  const [detectedData, setDetectedData] = useState([]);

  const [currentImage, setCurrentImage] = useState(null);

  useEffect(() => {
    let intervalId;
    if (webcamRunning) {
      intervalId = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * SignImageData.length);
        const randomImage = SignImageData[randomIndex];
        setCurrentImage(randomImage);
      }, 5000);
    }
    return () => clearInterval(intervalId);
  }, [webcamRunning]);

  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "production"
  ) {
    console.log = function () {};
  }

  const predictWebcam = useCallback(() => {
    if (runningMode === "IMAGE") {
      setRunningMode("VIDEO");
      gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();
    const results = gestureRecognizer.recognizeForVideo(
      webcamRef.current.video,
      nowInMs
    );

    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set video width
    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;

    // Set canvas height and width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    // Draw the results on the canvas, if any.
    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,
        });

        drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
      }
    }
    if (results.gestures.length > 0) {
      setDetectedData((prevData) => [
        ...prevData,
        {
          SignDetected: results.gestures[0][0].categoryName,
        },
      ]);

      setGestureOutput(results.gestures[0][0].categoryName);
      setProgress(Math.round(parseFloat(results.gestures[0][0].score) * 100));
    } else {
      setGestureOutput("");
      setProgress("");
    }

    if (webcamRunning === true) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, runningMode, gestureRecognizer, setGestureOutput]);

  const animate = useCallback(() => {
    requestRef.current = requestAnimationFrame(animate);
    predictWebcam();
  }, [predictWebcam]);

  const enableCam = useCallback(() => {
    if (!gestureRecognizer) {
      alert("Please wait for gestureRecognizer to load");
      return;
    }

    console.log("GestureRecognizer loaded");

    if (webcamRunning === true) {
      setWebcamRunning(false);
      cancelAnimationFrame(requestRef.current);
      setCurrentImage(null);

      const endTime = new Date();

      const timeElapsed = (
        (endTime.getTime() - startTime.getTime()) /
        1000
      ).toFixed(2);

      // Remove empty values
      const nonEmptyData = detectedData.filter(
        (data) => data.SignDetected !== "" && data.DetectedScore !== ""
      );

      //to filter continous same signs in an array
      const resultArray = [];
      let current = nonEmptyData[0];

      for (let i = 1; i < nonEmptyData.length; i++) {
        if (nonEmptyData[i].SignDetected !== current.SignDetected) {
          resultArray.push(current);
          current = nonEmptyData[i];
        }
      }

      resultArray.push(current);

      //calculate count for each repeated sign
      const countMap = new Map();

      for (const item of resultArray) {
        const count = countMap.get(item.SignDetected) || 0;
        countMap.set(item.SignDetected, count + 1);
      }

      const sortedArray = Array.from(countMap.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      const outputArray = sortedArray
        .slice(0, 5)
        .map(([sign, count]) => ({ SignDetected: sign, count }));

      setDetectedData([]);
    } else {
      setWebcamRunning(true);
      startTime = new Date();
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [webcamRunning, gestureRecognizer, animate, detectedData]);

  useEffect(() => {
    async function loadGestureRecognizer() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "/islreact/Trained-Model/sign_language_recognizer_25-04-2023.task",
        },
        numHands: 2,
        runningMode: runningMode,
      });
      setGestureRecognizer(recognizer);
    }
    loadGestureRecognizer();
  }, [runningMode]);

  // const handleFileChange = (event) => {
  //   const fileInput = event.target.files[0];
  //   if (fileInput && fileInput.files && fileInput.files.length > 0) {
  //     const file = fileInput.files[0]; // Get the first uploaded file
  //     console.log("Uploaded file:", file);

  //     // Example: Create a URL for the file and set it as the video source
  //     const videoURL = URL.createObjectURL(file);
  //     uploadedVideoRef.current.src = videoURL; // Assuming you want to play it in a video element
  //   } else {
  //     console.error("No file uploaded");
  //   }
  // };

  // useEffect(() => {
  //   // const processUploadedVideo = async () => {
  //   //   const video = uploadedVideoRef.current;
  //   //   const signs = [];
  //   //   const processFrame = async () => {
  //   //     if (video.ended || video.paused) {
  //   //       const uniqueSigns = [];
  //   //       for (let i = 0; i < signs.length; i++) {
  //   //         if (i === 0 || signs[i] !== signs[i - 1]) {
  //   //           uniqueSigns.push(signs[i]);
  //   //         }
  //   //       }
  //   //       console.log(finalSigns);
  //   //       const finalSigns = uniqueSigns.slice(-15);
  //   //       const resultString = finalSigns.map((s) => s + "...").join("");
  //   //       setOutputString(resultString);
  //   //       return;
  //   //     }
  //   //     const now = Date.now();
  //   //     const result = await gestureRecognizer.recognizeForVideo(video, now);
  //   //     if (result.gestures.length > 0) {
  //   //       signs.push(result.gestures[0][0].categoryName);
  //   //     }
  //   //     requestAnimationFrame(processFrame);
  //   //   };
  //   //   video.play();
  //   //   processFrame();
  //   // };
  // }, []);

  return (
    <>
      <div className="signlang_detection-container">
        {/* LEFT: Webcam + Canvas + Start/Stop Box */}
        <div className="signlang_left-section">
          <div style={{ position: "relative" }}>
            <Webcam audio={false} ref={webcamRef} className="signlang_webcam" />
            <canvas ref={canvasRef} className="signlang_canvas" />
          </div>

          <div className="signlang_data-container">
            <button onClick={enableCam}>
              {webcamRunning ? "Stop" : "Start"}
            </button>

            {/* <input type="file" onchange={handleFileChange} ref={uploadedVideoRef}/>
            <button onClick={handleFileChange}>Upload</button> */}

            <div className="signlang_data">
              <p className="gesture_output">{gestureOutput}</p>
              {progress ? <ProgressBar progress={progress} /> : null}
            </div>
          </div>
        </div>

        {/* RIGHT: Image Display */}
        <div className="signlang_imagelist-container">
          <h2 className="gradient__text">Image</h2>

          <div className="signlang_image-div">
            {currentImage ? (
              <img src={currentImage.url} alt={`img ${currentImage.id}`} />
            ) : (
              <h3 className="gradient__text">
                Click on the Start Button <br /> to practice with Images
              </h3>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Detect;
