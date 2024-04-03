"use client";
import React, { useEffect, useRef, useState } from "react";
import { MoonLoader } from "react-spinners";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { Coins, Scan, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

import SpinLoading from "@/components/loading/SpinLoading";
import Toast from "@/utils/toast";

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

const Page: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [photoData, setPhotoData] = useState<any | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [aiLoading, setaiLoading] = useState(false);
    const [aiData, setAiData] = useState<any | null>(null);
    const searchParams = useSearchParams();
    const recycle = searchParams.get("recycle");
    const wasteName = searchParams.get("wasteName");
    const wasteType = searchParams.get("wasteType");
    const material = searchParams.get("material");
    const [claimRewards, setClaimRewards] = useState<boolean>(false);
    const [disableCapture, setDisableCapture] = useState<boolean>(false);
    const [dumpLoading, setDumpLoading] = useState<boolean>(false);
    const [apires, setapires] = useState("");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [coupons, setCoupons] = useState<any[]>([]); // Added coupon state

    useEffect(() => {
        const generateCouponCode = () => {
            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            const length = 8;
            let couponCode = "";
            for (let i = 0; i < length; i++) {
                couponCode += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return couponCode;
        };

        // Generate dummy coupons
        const services = ["Zomato", "Swiggy", "Uber Eats", "Amazon", "Netflix", "Starbucks", "Gym", "Spa", "Movie Theater", "Bookstore"];
        const dummyCoupons = Array.from({ length: 200 }, (_, index) => ({
            id: index + 1,
            service: services[Math.floor(Math.random() * services.length)],
            discount: "Buy one, get one free on any item",
            code: generateCouponCode(),
        }));

        setCoupons(dummyCoupons.slice(0, 1));
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) {
                setLoading(false);
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            Toast.ErrorShowToast("Error accessing camera");
            console.error("Error accessing camera:", err);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataURL = canvas.toDataURL("image/jpeg");
                setPhotoData(dataURL);
                setDisableCapture(true);
            }
        }
    };

    const claimPointsAndCoupon = async () => {
        setClaimRewards(true);
        setDumpLoading(true);
        try {
            const res = await fetch("/api/add-points", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    isRecyclable: Boolean(recycle),
                    wasteNameByAi: wasteName,
                    wasteType: wasteType,
                    latitude: latitude!,
                    longitude: longitude!,
                    service: coupons[0].service,
                    discount: coupons[0].discount,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                Toast.SuccessshowToast(`${recycle == "true" ? 12 : 5} Points credited `);
                setDumpLoading(false);
                setapires(data);
                console.log(data);
            } else {
                const data = await res.json();
                Toast.ErrorShowToast(data.error || "Error claiming points");
                console.error(data);
            }
        } catch (err) {
            Toast.ErrorShowToast("Error claiming points");
            console.error("Error claiming points:", err);
        } finally {
            setDumpLoading(false);
        }
    };

    const scanImage = async () => {
        try {
            setaiLoading(true);
            const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({ model: "gemini-pro-vision", safetySettings: safetySettings });
            const prompt = "Does this look like a dustbin to you respond with yes or no";
            const formatMatch = photoData.match(/^data:(image\/(\w+));base64,/);
            if (!formatMatch) {
                console.error("Unsupported image format");
                Toast.ErrorShowToast("Unsupported image format");
                return;
            }

            const image = {
                inlineData: {
                    data: photoData.replace(formatMatch[0], ""),
                    mimeType: "image/jpeg",
                },
            };

            const result = await model.generateContent([prompt, image]);
            setaiLoading(false);
            setAiData(result.response.text());
        } catch (err) {
            console.error("Error scanning image:", err);
            Toast.ErrorShowToast("Error scanning image");
        } finally {
            setaiLoading(false);
        }
    };

    useEffect(() => {
        if (photoData) {
            scanImage();
        }
    }, [photoData]);

    useEffect(() => {
        startCamera();
    }, []);

    useEffect(() => {
        const getLocation = () => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    Toast.ErrorShowToast("Error getting location");
                },
            );
        };

        getLocation();
    }, []);

    return (
        <div className="flex relative flex-col  mt-4 w-full mb-40">
            <h1 className=" flex items-start justify-start mb-7 text-3xl font-bold text-start">Dump Waste</h1>
            <div>
                {loading ? <div className="w-full rounded-lg relative animate-pulse bg-black/80" style={{ height: "400px", borderRadius: "50px" }} /> : <video ref={videoRef} autoPlay muted className=" w-full rounded-lg relative h-96" />}
                {!disableCapture && (
                    <button onClick={capturePhoto} className=" bg-green-600 w-16 h-16 m-auto rounded-full  flex gap-3 items-center text-center justify-center  text-3xl font-bold text-white mt-7  p-4">
                        <div className="flex flex-col gap-3">
                            <Scan size={40} />
                        </div>
                    </button>
                )}
            </div>
            {aiLoading ? (
                <div className=" bg-black/80 w-full min-h-screen fixed left-0 right-0 top-0">
                    <div className="flex justify-center items-center min-h-screen">
                        <MoonLoader color="#fff" size={90} />
                    </div>
                </div>
            ) : (
                <>
                    {aiData && (
                        <div className="  bg-black/5 shadow-lg w-full mt-12 mb-28 rounded-2xl border-2 border-black/10">
                            <div className="flex flex-col gap-4  p-4">
                                <h1 className="text-2xl uppercase font-bold">Is Dustbin ? {aiData}</h1>
                                <h1 className=" text-xl opacity-60 font-bold uppercase">isRecycleItem = {recycle}</h1>
                                <h1>wasteName : {wasteName}</h1>
                                <h1>Waste Type {wasteType}</h1>
                                <h1>Material : {material}</h1>
                                <button onClick={claimPointsAndCoupon} className=" flex justify-center items-center gap-3 bg-green-600 text-white p-5 rounded-lg">
                                    <Coins />
                                    Claim Rewards{" "}
                                </button>

                                <div className={`absolute bg-green-500 z-50 w-[90%] m-auto right-0 left-0 h-96 rounded-lg top-16 ${claimRewards ? "scale-100" : "scale-0"} duration-200`}>
                                    <div className="flex p-4 text-white justify-end items-end">
                                        <X size={40} onClick={() => setClaimRewards(false)} />
                                    </div>
                                    {dumpLoading ? (
                                        <div className="flex h-full justify-center items-center">
                                            <SpinLoading />
                                        </div>
                                    ) : (
                                        <>
                                            <h1 className=" text-3xl font-bold text-center">Coupon Received</h1>
                                            <div className="flex flex-col text-center text-white font-bold text-lg">
                                                <h1>{recycle == "true" ? "Points earned 12" : "points earned 5"}</h1>
                                                <h2>Coupons:</h2>
                                                <ul>
                                                    {coupons.slice(0, 2).map((coupon, index) => (
                                                        <li key={index}>
                                                            <span>Service: {coupon.service}</span>
                                                            <br />
                                                            <span>Discount: {coupon.discount}</span>
                                                            <br />
                                                            <span>Coupon Code: {coupon.code}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Page;
