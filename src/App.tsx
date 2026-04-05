/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { 
  Sparkles, 
  Upload, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon,
  Type as TextIcon,
  Palette,
  Zap,
  UserPlus,
  MessageSquare,
  ExternalLink,
  Bookmark,
  Share2,
  Map,
  Layout,
  BookOpen,
  Users,
  MessageSquareText,
  PhoneCall,
  Presentation,
  History,
  Coins,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Toaster, toast } from 'sonner';

// --- Types ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface ImportMetaEnv {
    readonly VITE_MAKE_WEBHOOK_URL: string;
  }
}

interface SlideContent {
  step: string;
  headline: string;
  subtext: string;
  visualPrompt: string;
}

interface CarouselData {
  topic: string;
  style: string;
  slides: SlideContent[];
}

interface GeneratedSlide {
  index: number;
  imageUrl: string;
}

const STYLES = [
  { id: 'viral', name: 'Viral', description: 'High contrast, bright colors, bold fonts', color: 'bg-yellow-400', exampleImage: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHR6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxcaOXYT6w/giphy.gif' },
  { id: 'luxury', name: 'Luxury', description: 'Minimal, gold/black/white, serif fonts', color: 'bg-slate-900', exampleImage: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHR6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l41lTfuxV5R8e2vXG/giphy.gif' },
  { id: 'minimal', name: 'Minimal', description: 'Clean, lots of white space, modern', color: 'bg-white border', exampleImage: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHR6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKVUn7iM8FMEU24/giphy.gif' },
  { id: 'dark', name: 'Dark', description: 'Neon accents, high-tech, futuristic', color: 'bg-black', exampleImage: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHR6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxcaOXYT6w/giphy.gif' },
  { id: 'custom', name: 'Custom', description: 'Clone style from your image', color: 'bg-gradient-to-br from-indigo-500 to-purple-500', exampleImage: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHR6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6eXN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxxcaOXYT6w/giphy.gif' },
];

const GOALS = [
  { id: 'follow', name: 'Follow', description: 'Grow your audience', icon: 'UserPlus' },
  { id: 'comment', name: 'Lead Magnet', description: 'Comment keyword for bonus', icon: 'MessageSquare' },
  { id: 'link', name: 'Link in Bio', description: 'Drive traffic to site', icon: 'ExternalLink' },
  { id: 'save', name: 'Save', description: 'Educational value', icon: 'Bookmark' },
  { id: 'share', name: 'Viral Share', description: 'Maximize reach', icon: 'Share2' },
];

const STEPS = [
  "Hook", "Problem", "Pain", "Solution", "Explanation", "Benefits", "Comparison", "CTA"
];

// --- App Component ---
export default function App() {
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedGoal, setSelectedGoal] = useState(GOALS[0].id);
  const [keyword, setKeyword] = useState('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [generatedSlides, setGeneratedSlides] = useState<GeneratedSlide[]>([]);
  const [carouselData, setCarouselData] = useState<CarouselData | null>(null);
  const [userPhysicalProfile, setUserPhysicalProfile] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'generator' | 'roadmap' | 'clone' | 'learning' | 'recruiting' | 'comms' | 'presentations'>('roadmap');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Привіт! Я твій AI-асистент для MLM. Чим можу допомогти сьогодні?' }
  ]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Billing Tracker State
  const [totalCost, setTotalCost] = useState(() => {
    const saved = localStorage.getItem('mlm_ai_total_cost');
    return saved ? parseFloat(saved) : 0;
  });
  const [lastActionCost, setLastActionCost] = useState<number | null>(null);
  const [showCostPopup, setShowCostPopup] = useState(false);

  // Persistence for billing
  React.useEffect(() => {
    localStorage.setItem('mlm_ai_total_cost', totalCost.toString());
  }, [totalCost]);

  // Pricing Constants (Tier 2 Estimates)
  const PRICE_PER_1M_INPUT = 0.075;
  const PRICE_PER_1M_OUTPUT = 0.30;
  const PRICE_PER_IMAGE = 0.03;

  const updateCost = (inputTokens: number, outputTokens: number, images = 0) => {
    const textCost = (inputTokens / 1000000) * (inputTokens > 0 ? PRICE_PER_1M_INPUT : 0) + (outputTokens / 1000000) * (outputTokens > 0 ? PRICE_PER_1M_OUTPUT : 0);
    const imageCost = images * PRICE_PER_IMAGE;
    const total = textCost + imageCost;
    
    // Ensure we don't add 0 if it's just a heartbeat
    if (total > 0) {
      setTotalCost(prev => prev + total);
      setLastActionCost(total);
      setShowCostPopup(true);
      setTimeout(() => setShowCostPopup(false), 4000);
    }
  };

  // Digital Twin / AI Clone State
  const [isTraining, setIsTraining] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<'idle' | 'training' | 'ready'>('idle');
  const [cloneData, setCloneData] = useState<{
    name: string;
    profile: string;
    style: string;
    photos: string[];
  }>({
    name: '',
    profile: '',
    style: '',
    photos: []
  });

  const ROADMAP_STEPS = [
    {
      phase: "Фаза 01",
      title: "Контент-двигун",
      status: "Активно",
      items: [
        "AI Агент для каруселей (MLM)",
        "Бібліотека віральних гачків",
        "Мультимовна підтримка"
      ],
      icon: <Sparkles className="w-5 h-5" />
    },
    {
      phase: "Фаза 02",
      title: "Навчальний Хаб",
      status: "В розробці",
      items: [
        "Освітня платформа для партнерів",
        "Інтерактивні модулі навчання",
        "Система оцінки навичок",
        "Гейміфікований онбординг"
      ],
      icon: <BookOpen className="w-5 h-5" />
    },
    {
      phase: "Фаза 03",
      title: "Розумний Рекрутинг",
      status: "Заплановано",
      items: [
        "Автоматичне захоплення лідів",
        "Конструктор воронки рекрутингу",
        "Панель управління партнерами",
        "Аналітика ефективності команди"
      ],
      icon: <Users className="w-5 h-5" />
    },
    {
      phase: "Фаза 04",
      title: "AI Комунікації",
      status: "Заплановано",
      items: [
        "Автоматичне SMS-супроводження",
        "AI Голосові авто-дзвінки",
        "Система скорингу лідів",
        "Інтеграція з CRM"
      ],
      icon: <PhoneCall className="w-5 h-5" />
    },
    {
      phase: "Фаза 05",
      title: "Авто-Презентації",
      status: "Заплановано",
      items: [
        "Динамічні AI презентації",
        "Агент для Q&A в реальному часі"
      ],
      icon: <Presentation className="w-5 h-5" />
    }
  ];
  const [isRegeneratingSlide, setIsRegeneratingSlide] = useState<number | null>(null);
  const [regenInstructions, setRegenInstructions] = useState('');
  const [isExportingToMake, setIsExportingToMake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callGemini = async (params: any, maxRetries = 3) => {
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) throw new Error("API Key missing");
        
        const ai = new GoogleGenAI({ apiKey });
        
        // Optimize for cost/quota on flash models if not already set
        if (params.model?.includes('flash') && !params.config?.thinkingConfig && !params.model.includes('image')) {
          params.config = {
            ...params.config,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          };
        }

        const response = await ai.models.generateContent(params);
        
        // Update cost based on usage metadata
        if (response.usageMetadata) {
          updateCost(
            response.usageMetadata.promptTokenCount || 0,
            response.usageMetadata.candidatesTokenCount || 0,
            params.model?.includes('image') ? 1 : 0
          );
        } else if (params.model?.includes('image')) {
          // Fallback for image models if metadata is missing
          updateCost(0, 0, 1);
        }

        return response;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");
        const isTransientError = errorMsg.includes("503") || errorMsg.includes("504") || errorMsg.includes("Deadline expired") || errorMsg.includes("UNAVAILABLE");
        
        if ((isQuotaError || isTransientError) && retries < maxRetries) {
          const delay = Math.pow(2, retries) * 2000;
          console.warn(`Gemini API Error (${isQuotaError ? 'Quota' : 'Transient'}). Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          continue;
        }
        
        if (isQuotaError) {
          toast.error("Перевищено ліміт запитів (Quota Exceeded). Будь ласка, зачекайте хвилину або підключіть власний API ключ у налаштуваннях.");
        } else if (isTransientError) {
          toast.error("Сервіс Gemini тимчасово недоступний (Timeout/503). Спробуйте ще раз через кілька секунд.");
        }
        throw err;
      }
    }
  };
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [useAiWardrobe, setUseAiWardrobe] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  // Check if API key is selected on mount
  React.useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsApiKey(!hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false); // Assume success per instructions
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        if (activeTab === 'clone') {
          setCloneData(prev => ({
            ...prev,
            photos: [...prev.photos, base64].slice(0, 4)
          }));
        } else {
          setUserPhoto(base64);
          
          // Analyze photo for physical profile to ensure consistency
          try {
            const response = await callGemini({
              model: "gemini-3-flash-preview",
              contents: [
                { text: "Analyze this person's face. Provide a detailed but concise physical profile including: gender, approximate age, skin tone, eye color, hair style/color, facial hair, and any distinct features. This will be used to ensure consistency in AI image generation." },
                { inlineData: { data: base64.split(',')[1], mimeType: "image/png" } }
              ]
            });
            setUserPhysicalProfile(response?.text || null);
          } catch (err) {
            console.error("Failed to analyze photo:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStyleImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCarousel = async () => {
    if (!topic) {
      setError("Please enter a topic first.");
      return;
    }

    if (selectedGoal === 'comment' && !keyword) {
      setError("Please enter a keyword for the bonus.");
      return;
    }

    if (selectedStyle === 'custom' && !styleImage) {
      setError("Please upload a reference style image.");
      return;
    }

    // Check key again before starting
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setNeedsApiKey(true);
        return;
      }
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setGeneratedSlides([]);
    setCurrentSlideIndex(0);

    try {
      // Create a new instance right before making an API call to ensure it uses the most up-to-date key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '' });
      
      let customStylePrompt = "";
      if (selectedStyle === 'custom' && styleImage) {
        setStatus("Analyzing your custom style...");
        const analysisResponse = await callGemini({
          model: "gemini-3-flash-preview",
          contents: [
            { text: "Analyze the visual style of this image. Describe the color palette, typography (serif/sans-serif, bold/light), layout patterns, lighting, and overall vibe. Provide a concise prompt that can be used to replicate this exact style for new designs." },
            { inlineData: { data: styleImage.split(',')[1], mimeType: "image/png" } }
          ]
        });
        customStylePrompt = analysisResponse?.text || "";
        setProgress(5);
      }

      // Step 1 & 2: Strategy & Copywriting
      setStatus("Strategizing your carousel hooks and copy...");
      
      const goalPrompt = getGoalPrompt(selectedGoal, keyword);
      
      const strategyResponse = await callGemini({
        model: "gemini-3-flash-preview",
        contents: `Generate an 8-slide Instagram carousel strategy and copy for the topic: "${topic}". 
        Style: ${selectedStyle === 'custom' ? customStylePrompt : selectedStyle}.
        Structure: Hook → Problem → Pain → Solution → Explanation → Benefits → Comparison → CTA.
        Final Goal (Slide 8): ${goalPrompt}.
        Rules: Minimal words, big emotional triggers, clear hierarchy (headline + small subtext).
        The layout for each slide will feature a person on one side and text on the other. 
        Provide a detailed visual prompt for an image generation model for each slide, describing 3D icons or UI elements to include.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    subtext: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING }
                  },
                  required: ["step", "headline", "subtext", "visualPrompt"]
                }
              }
            },
            required: ["slides"]
          }
        }
      });

      const carouselDataJson = JSON.parse(strategyResponse?.text || '{}') as CarouselData;
      setCarouselData(carouselDataJson);
      setProgress(10);

      // Step 3 & 4: Design & Image Generation
      const slides: GeneratedSlide[] = [];
      const OUTFITS = [
        "professional tailored business suit",
        "modern premium hoodie and streetwear",
        "smart casual linen shirt",
        "tech-founder style black t-shirt and blazer",
        "stylish athletic performance wear",
        "luxury designer evening outfit",
        "creative artistic minimalist clothing",
        "elegant turtleneck and coat"
      ];
      
      for (let i = 0; i < carouselDataJson.slides.length; i++) {
        const slide = carouselDataJson.slides[i];
        setStatus(`Designing slide ${i + 1}/8: ${slide.step}...`);
        
        const stylePrompt = selectedStyle === 'custom' ? customStylePrompt : getStylePrompt(selectedStyle);
        const outfit = OUTFITS[i % OUTFITS.length];

        const fullPrompt = `Create a high-end Instagram carousel slide for: "${slide.headline}". 
        Subtext: "${slide.subtext}".
        Visual requirements: ${slide.visualPrompt}.
        Overall Style: ${stylePrompt}.
        
        COMPOSITION & STYLE:
        - STYLE: Minimal white or light background, Bold marketing typography, Bright accent colors (green, yellow, red), 3D icons (coins, charts, arrows), Modern Instagram viral design.
        - COMPOSITION: Person on one side (left or right), Text blocks on the opposite side. Add speech bubbles or floating UI elements around the person.
        - LIGHTING: Professional photoshoot lighting. Match lighting between the person and the background. Add a soft glow if needed.
        - OUTPUT: Photorealistic, premium marketing design, 1:1 ratio.
        
        IMPORTANT:
        - Integrate the text "${slide.headline}" and "${slide.subtext}" INTO the visual design naturally using bold marketing typography.
        - DO NOT place the photo as a separate rectangle. DO NOT overlay it. 
        - Instead: Blend the person into the scene naturally. They should feel like they are part of the professional photoshoot composition.
        - The person should be engaging with the camera.
        
        ${(userPhoto || cloneData.photos.length > 0) ? `INTEGRATE the provided person photo into the design naturally. 
        Person Profile: ${cloneStatus === 'ready' ? cloneData.profile : (userPhysicalProfile || "Use the provided photo for reference")}.
        ${useAiWardrobe ? `CRITICAL: Change the person's clothing to a ${outfit}. Keep the face and features EXACTLY identical to the photo, but the outfit must be a ${outfit}.` : "Keep their original clothing."} 
        The face MUST be a perfect match to the reference photo. Blend them into the scene with soft shadows and matching lighting.` : ""}`;

        const imageParts: any[] = [{ text: fullPrompt }];
        const referencePhoto = (cloneStatus === 'ready' && cloneData.photos.length > 0) ? cloneData.photos[0] : userPhoto;
        
        if (referencePhoto) {
          imageParts.push({
            inlineData: {
              data: referencePhoto.split(',')[1],
              mimeType: "image/png"
            }
          });
        }

        // Re-initialize AI instance for each image call to be safe with keys
        let attempts = 0;
        let success = false;
        let imageUrl = "";

        while (attempts < 2 && !success) {
          attempts++;
          const imageResponse = await callGemini({
            model: 'gemini-3.1-flash-image-preview',
            contents: { parts: imageParts },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
              }
            }
          });

          const imagePart = imageResponse?.candidates?.[0]?.content?.parts.find(p => p.inlineData);
          if (imagePart?.inlineData) {
            imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
            
            if (referencePhoto) {
              setStatus(`Verifying face match for slide ${i + 1}...`);
              const verifyResponse = await callGemini({
                model: "gemini-3-flash-preview",
                contents: [
                  { text: "Compare the person in the 'Generated Image' with the 'Reference Photo'. Does the face in the Generated Image look like the same person? Answer with 'YES' or 'NO' and a brief reason." },
                  { text: "Reference Photo:" },
                  { inlineData: { data: referencePhoto.split(',')[1], mimeType: "image/png" } },
                  { text: "Generated Image:" },
                  { inlineData: { data: imagePart.inlineData.data, mimeType: "image/png" } }
                ]
              });
              
              if (verifyResponse?.text?.toUpperCase().includes("YES")) {
                success = true;
              } else if (attempts < 2) {
                setStatus(`Face match low. Retrying slide ${i + 1}...`);
              } else {
                success = true; // Use it anyway on last attempt
              }
            } else {
              success = true;
            }
          }
        }

        if (imageUrl) {
          slides.push({ index: i, imageUrl });
          setGeneratedSlides([...slides]);
          setProgress(10 + ((i + 1) / 8) * 90);
        }
      }

      setStatus("Carousel complete!");
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found") || err.message?.includes("PERMISSION_DENIED")) {
        setNeedsApiKey(true);
        setError("API Key permission error. Please select a valid paid API key.");
      } else {
        setError("Failed to generate carousel. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateSlide = async (index: number) => {
    if (!carouselData) return;
    
    setIsRegeneratingSlide(index);
    setError(null);

    try {
      const slide = carouselData.slides[index];
      
      // Step 1: Update text if instructions are provided
      let updatedHeadline = slide.headline;
      let updatedSubtext = slide.subtext;
      let updatedVisualPrompt = slide.visualPrompt;

      if (regenInstructions) {
        try {
          const textUpdateResponse = await callGemini({
            model: "gemini-3-flash-preview",
            contents: [{ 
              text: `Update the text for this Instagram carousel slide based on these instructions: "${regenInstructions}".
              
              Current Slide Data:
              Headline: "${slide.headline}"
              Subtext: "${slide.subtext}"
              Visual Prompt: "${slide.visualPrompt}"
              
              Return a JSON object with updated "headline", "subtext", and "visualPrompt" fields. 
              Keep the tone professional and high-end. Use Ukrainian for headline and subtext.
              The headline should be short and punchy (max 5-7 words).
              The subtext should be a brief explanation (max 15-20 words).` 
            }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  subtext: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING }
                },
                required: ["headline", "subtext", "visualPrompt"]
              }
            }
          });

          const updatedData = JSON.parse(textUpdateResponse.text || "{}");
          if (updatedData.headline) updatedHeadline = updatedData.headline;
          if (updatedData.subtext) updatedSubtext = updatedData.subtext;
          if (updatedData.visualPrompt) updatedVisualPrompt = updatedData.visualPrompt;
        } catch (err) {
          console.error("Failed to update slide text:", err);
        }
      }

      const OUTFITS = [
        "professional tailored business suit",
        "modern premium hoodie and streetwear",
        "smart casual linen shirt",
        "tech-founder style black t-shirt and blazer",
        "stylish athletic performance wear",
        "luxury designer evening outfit",
        "creative artistic minimalist clothing",
        "elegant turtleneck and coat"
      ];
      
      const stylePrompt = selectedStyle === 'custom' ? "custom style" : getStylePrompt(selectedStyle);
      const outfit = OUTFITS[index % OUTFITS.length];

      const fullPrompt = `Create a high-end Instagram carousel slide for: "${updatedHeadline}". 
      Subtext: "${updatedSubtext}".
      Visual requirements: ${updatedVisualPrompt}.
      Overall Style: ${stylePrompt}.
      
      ${regenInstructions ? `USER CUSTOM INSTRUCTIONS FOR THIS REGENERATION: "${regenInstructions}". Prioritize these instructions over others.` : ""}
      
      COMPOSITION & STYLE:
      - STYLE: Minimal white or light background, Bold marketing typography, Bright accent colors (green, yellow, red), 3D icons (coins, charts, arrows), Modern Instagram viral design.
      - COMPOSITION: Person on one side (left or right), Text blocks on the opposite side. Add speech bubbles or floating UI elements around the person.
      - LIGHTING: Professional photoshoot lighting. Match lighting between the person and the background. Add a soft glow if needed.
      - OUTPUT: Photorealistic, premium marketing design, 1:1 ratio.
      
      IMPORTANT:
      - Integrate the text "${updatedHeadline}" and "${updatedSubtext}" INTO the visual design naturally using bold marketing typography.
      - DO NOT place the photo as a separate rectangle. DO NOT overlay it. 
      - Instead: Blend the person into the scene naturally. They should feel like they are part of the professional photoshoot composition.
      - The person should be engaging with the camera.
      
      ${(userPhoto || cloneData.photos.length > 0) ? `INTEGRATE the provided person photo into the design naturally. 
      Person Profile: ${cloneStatus === 'ready' ? cloneData.profile : (userPhysicalProfile || "Use the provided photo for reference")}.
      ${useAiWardrobe ? `CRITICAL: Change the person's clothing to a ${outfit}. Keep the face and features EXACTLY identical to the photo, but the outfit must be a ${outfit}.` : "Keep their original clothing."} 
      The face MUST be a perfect match to the reference photo. Blend them into the scene with soft shadows and matching lighting.` : ""}`;

      const imageParts: any[] = [{ text: fullPrompt }];
      const referencePhoto = (cloneStatus === 'ready' && cloneData.photos.length > 0) ? cloneData.photos[0] : userPhoto;
      
      if (referencePhoto) {
        imageParts.push({
          inlineData: {
            data: referencePhoto.split(',')[1],
            mimeType: "image/png"
          }
        });
      }

      const imageResponse = await callGemini({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: imageParts },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      const imagePart = imageResponse?.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        
        // Update the slide in state
        const newSlides = [...generatedSlides];
        newSlides[index] = { index, imageUrl };
        setGeneratedSlides(newSlides);
        
        // Update carouselData for consistency
        if (carouselData) {
          const updatedCarouselSlides = [...carouselData.slides];
          updatedCarouselSlides[index] = {
            ...updatedCarouselSlides[index],
            headline: updatedHeadline,
            subtext: updatedSubtext,
            visualPrompt: updatedVisualPrompt
          };
          setCarouselData({
            ...carouselData,
            slides: updatedCarouselSlides
          });
        }

        setRegenInstructions('');
        
        // Track cost
        const cost = 0.04; // Fixed cost for image gen + text update
        setTotalCost(prev => prev + cost);
        setLastActionCost(cost);
        setShowCostPopup(true);
        setTimeout(() => setShowCostPopup(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to regenerate slide image.");
    } finally {
      setIsRegeneratingSlide(null);
    }
  };

  const getGoalPrompt = (goal: string, kw: string) => {
    switch (goal) {
      case 'follow': return "The final slide must strongly encourage the user to follow the account for more high-value tips and content.";
      case 'comment': return `The final slide must be a lead magnet offer. Tell the user to comment the keyword "${kw}" to receive a special bonus/guide in their DMs.`;
      case 'link': return "The final slide must direct the user to the link in the bio to take action (e.g., buy, book a call, or download).";
      case 'save': return "The final slide must emphasize that this content is valuable and should be saved for future reference.";
      case 'share': return "The final slide must encourage the user to share this carousel with a friend or colleague who would benefit from it.";
      default: return "";
    }
  };

  const getStylePrompt = (style: string) => {
    switch (style) {
      case 'viral': return "High-end viral marketing aesthetic, high contrast, vibrant green and yellow accents, bold heavy typography, 3D floating icons (coins, charts), dynamic shadows, professional studio lighting.";
      case 'luxury': return "Premium luxury brand aesthetic, minimal, gold and black color palette, elegant serif typography, high-end product photography style, sophisticated lighting.";
      case 'minimal': return "Clean high-end minimal design, white or light background, soft shadows, modern bold sans-serif typography, bright accent colors, organized professional layout.";
      case 'dark': return "Premium dark mode aesthetic, deep blacks, neon cyan and indigo accents, futuristic tech feel, glowing 3D UI components, high-tech professional look.";
      default: return "";
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder("carousel-factory");
    
    generatedSlides.forEach((slide, idx) => {
      const base64Data = slide.imageUrl.split(',')[1];
      folder?.file(`slide-${idx + 1}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "instagram-carousel.zip");
  };

  const exportToMake = async () => {
    if (generatedSlides.length === 0) return;
    
    const webhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL;
    
    if (!webhookUrl) {
      toast.error("MAKE_WEBHOOK_URL не налаштовано. Будь ласка, додайте його в налаштуваннях.");
      return;
    }

    setIsExportingToMake(true);
    const toastId = toast.loading("Надсилання даних у Make.com...");

    try {
      const payload = {
        timestamp: new Date().toISOString(),
        carousel_name: `MLM_Carousel_${new Date().getTime()}`,
        slides_count: generatedSlides.length,
        slides: generatedSlides.map((s, i) => ({
          index: i + 1,
          image_url: s.imageUrl,
          caption: s.caption,
          title: s.title,
          description: s.description
        }))
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Дані успішно надіслано в Make.com!", { id: toastId });
      } else {
        throw new Error("Помилка при надсиланні");
      }
    } catch (error) {
      console.error("Make Export Error:", error);
      toast.error("Не вдалося надіслати дані в Make. Перевірте консоль або URL вебхука.", { id: toastId });
    } finally {
      setIsExportingToMake(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-slate-300 font-sans selection:bg-indigo-500/30 flex flex-col lg:flex-row overflow-hidden h-screen">
      <Toaster position="top-right" richColors closeButton theme="dark" />
      {/* AI Billing Tracker Floating Widget */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2"
      >
        <AnimatePresence>
          {showCostPopup && lastActionCost !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-green-500 text-black px-3 py-1 rounded-full text-[10px] font-mono font-bold shadow-lg flex items-center gap-1"
            >
              <Zap className="w-3 h-3 fill-current" />
              +${lastActionCost.toFixed(4)}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[180px]">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
            <Coins className="text-green-500 w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold">AI_Billing_Lifetime</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-white">${totalCost.toFixed(3)}</span>
              <span className="text-[10px] font-mono text-green-500 font-bold">USD</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Header */}
      <header className="lg:hidden h-16 border-b border-border-dim bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent-neon rounded-lg flex items-center justify-center shadow-lg">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <h1 className="font-bold text-lg tracking-tighter text-white font-mono uppercase">MLM_AI</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <Layout className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-black/95 lg:bg-black/40 border-r border-border-dim backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:static lg:block
      `}>
        <div className="p-8 border-b border-border-dim flex items-center gap-4">
          <div className="w-10 h-10 bg-accent-neon rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Zap className="text-white w-6 h-6 fill-current" />
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="font-bold text-xl tracking-tighter text-white font-mono uppercase">MLM_AI <span className="text-accent-cyan">v1.2</span></h1>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.3em] font-bold">Platform_Core</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          <div className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em] font-bold mb-4 px-4">Модулі</div>
          
          <button 
            onClick={() => { setActiveTab('roadmap'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTab === 'roadmap' ? 'bg-accent-neon/10 text-white border border-accent-neon/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
          >
            <Layout className={`w-5 h-5 ${activeTab === 'roadmap' ? 'text-accent-neon' : 'text-slate-600 group-hover:text-slate-400'}`} />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">Дорожня карта</span>
          </button>

            <button 
              onClick={() => { setActiveTab('generator'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTab === 'generator' ? 'bg-accent-neon/10 text-white border border-accent-neon/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
            >
              <Sparkles className={`w-5 h-5 ${activeTab === 'generator' ? 'text-accent-neon' : 'text-slate-600 group-hover:text-slate-400'}`} />
              <span className="text-sm font-mono font-bold uppercase tracking-widest">AI Контент</span>
            </button>

            <button 
              onClick={() => { setActiveTab('clone'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTab === 'clone' ? 'bg-accent-neon/10 text-white border border-accent-neon/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'clone' ? 'text-accent-neon' : 'text-slate-600 group-hover:text-slate-400'}`} />
              <span className="text-sm font-mono font-bold uppercase tracking-widest">AI Клон</span>
            </button>

          <button 
            disabled
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-700 cursor-not-allowed group"
          >
            <div className="flex items-center gap-4">
              <BookOpen className="w-5 h-5 text-slate-800" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest">Навчання</span>
            </div>
            <span className="text-[8px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-600">SOON</span>
          </button>

          <button 
            disabled
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-700 cursor-not-allowed group"
          >
            <div className="flex items-center gap-4">
              <Users className="w-5 h-5 text-slate-800" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest">Рекрутинг</span>
            </div>
            <span className="text-[8px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-600">SOON</span>
          </button>

          <button 
            onClick={() => { setActiveTab('comms'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTab === 'comms' ? 'bg-accent-neon/10 text-white border border-accent-neon/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
          >
            <MessageSquare className={`w-5 h-5 ${activeTab === 'comms' ? 'text-accent-neon' : 'text-slate-600 group-hover:text-slate-400'}`} />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">AI Комунікації</span>
          </button>

          <button 
            disabled
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-700 cursor-not-allowed group"
          >
            <div className="flex items-center gap-4">
              <Presentation className="w-5 h-5 text-slate-800" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest">Презентації</span>
            </div>
            <span className="text-[8px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-600">SOON</span>
          </button>
        </nav>

        <div className="p-6 border-t border-border-dim">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-500 font-mono text-xs">
              JD
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-[10px] font-bold text-white truncate uppercase tracking-widest">Мій Профіль</div>
              <div className="text-[8px] text-slate-500 truncate uppercase tracking-widest">Partner_ID: 8821</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="hidden lg:flex h-20 border-b border-border-dim bg-black/20 backdrop-blur-md items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent-neon animate-pulse" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-white">
              {activeTab === 'generator' ? 'AI_Генератор_Контенту' : activeTab === 'clone' ? 'AI_Цифровий_Двійник' : activeTab === 'comms' ? 'AI_Комунікатор' : 'Дорожня_карта_платформи'}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-widest">Система_Онлайн</span>
            </div>
            <button className="bg-white text-black px-6 py-2 rounded-full text-[10px] font-mono font-black hover:bg-accent-cyan transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] uppercase tracking-widest">
              Допомога
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 lg:gap-10">
            {/* Left Column */}
            <div className="space-y-10">
              <AnimatePresence mode="wait">
                {activeTab === 'generator' ? (
                  <motion.div
                    key="generator"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-accent-cyan/40 rounded flex items-center justify-center">
                          <Sparkles className="text-accent-cyan w-3 h-3" />
                        </div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-white">Параметри_Генерації</h2>
                      </div>
                    </div>

                    {/* API Key Selection (Required for Image Generation) */}
                    {needsApiKey && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-amber-500 w-5 h-5 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500 font-mono uppercase">Auth_Required</p>
                            <p className="text-[11px] text-amber-500/70 font-mono">
                              Image generation requires a paid Google Cloud project API key. 
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleSelectKey}
                          className="w-full bg-amber-500 text-black py-2 rounded-lg text-[11px] font-mono font-bold hover:bg-amber-400 transition-colors"
                        >
                          CONNECT_API_KEY
                        </button>
                      </div>
                    )}

                    {/* Topic Input */}
                    <div className="space-y-3">
                      <label className="specialist-label">01 // Тема_Контенту</label>
                      <textarea 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Наприклад: 5 секретів масштабування MLM бізнесу до $10k"
                        className="w-full p-4 rounded-xl bg-black/40 border border-border-dim focus:border-accent-neon outline-none transition-all min-h-[120px] text-sm font-mono resize-none text-white placeholder:text-slate-700"
                      />
                    </div>

                    {/* Style Selector */}
                    <div className="space-y-4">
                      <label className="specialist-label">02 // Візуальний_Стиль</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {STYLES.map((style, idx) => (
                          <motion.button
                            key={style.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedStyle(style.id)}
                            className={`group relative rounded-2xl border transition-all duration-500 overflow-hidden flex flex-col h-full ${
                              selectedStyle === style.id 
                                ? 'border-accent-neon/50 bg-accent-neon/5 shadow-[0_0_40px_rgba(99,102,241,0.1)]' 
                                : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="aspect-[16/9] relative overflow-hidden">
                              <img 
                                src={style.exampleImage} 
                                alt={style.name} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/20 to-transparent" />
                              <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase tracking-widest text-white ${style.color} bg-opacity-80 backdrop-blur-sm`}>
                                {style.id}
                              </div>
                            </div>
                            <div className="p-4 lg:p-5 pt-2">
                              <div className="font-mono font-bold text-[10px] lg:text-xs text-white uppercase tracking-wider group-hover:text-accent-neon transition-colors">{style.name}</div>
                              <div className="text-[9px] lg:text-[10px] font-medium text-slate-400 leading-relaxed mt-2 uppercase tracking-tight opacity-80">{style.description}</div>
                            </div>
                            {selectedStyle === style.id && (
                              <motion.div 
                                layoutId="active-style-indicator"
                                className="absolute bottom-0 left-0 w-full h-1 bg-accent-neon shadow-[0_0_15px_rgba(99,102,241,1)]"
                              />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Style Upload */}
                    {selectedStyle === 'custom' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <label className="specialist-label">02.1 // Style_Reference</label>
                        <div 
                          onClick={() => styleInputRef.current?.click()}
                          className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                            styleImage ? 'border-accent-cyan bg-accent-cyan/5' : 'border-border-dim hover:border-accent-neon hover:bg-white/5'
                          }`}
                        >
                          <input 
                            type="file" 
                            ref={styleInputRef}
                            onChange={handleStyleUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          {styleImage ? (
                            <div className="flex items-center gap-4">
                              <img src={styleImage} alt="Style Ref" className="w-16 h-16 rounded-lg object-cover shadow-2xl border border-border-dim" />
                              <div className="text-left">
                                <p className="text-[10px] font-mono font-bold text-accent-cyan uppercase tracking-widest">Style_Captured</p>
                                <p className="text-[9px] font-mono text-slate-500 uppercase">Click to re-scan</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Palette className="text-slate-600 w-6 h-6" />
                              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Upload_Reference_Asset</p>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Goal Selector */}
                    <div className="space-y-4">
                      <label className="specialist-label">03 // Ціль_Конверсії</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {GOALS.map((goal, idx) => (
                          <motion.button
                            key={goal.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + idx * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedGoal(goal.id)}
                            className={`p-4 lg:p-6 rounded-2xl border transition-all duration-300 text-center flex flex-col items-center gap-3 relative overflow-hidden group ${
                              selectedGoal === goal.id 
                                ? 'border-accent-neon/50 bg-accent-neon/5 shadow-[0_0_30px_rgba(99,102,241,0.1)]' 
                                : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className={`p-3 rounded-xl transition-colors ${selectedGoal === goal.id ? 'bg-accent-neon/20 text-accent-neon' : 'bg-white/5 text-slate-500 group-hover:text-slate-300'}`}>
                              {goal.id === 'follow' && <UserPlus className="w-5 h-5" />}
                              {goal.id === 'comment' && <MessageSquare className="w-5 h-5" />}
                              {goal.id === 'link' && <ExternalLink className="w-5 h-5" />}
                              {goal.id === 'save' && <Bookmark className="w-5 h-5" />}
                              {goal.id === 'share' && <Share2 className="w-5 h-5" />}
                            </div>
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-xs text-white uppercase tracking-wider">{goal.name}</div>
                              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-widest opacity-60">{goal.description}</div>
                            </div>
                            {selectedGoal === goal.id && (
                              <motion.div 
                                layoutId="active-goal-indicator"
                                className="absolute bottom-0 left-0 w-full h-1 bg-accent-neon shadow-[0_0_15px_rgba(99,102,241,1)]"
                              />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Keyword Input for Lead Magnet */}
                    {selectedGoal === 'comment' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <label className="specialist-label">03.1 // Bonus_Keyword</label>
                        <input 
                          type="text"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                          placeholder="e.g. GUIDE, SCALE, BONUS"
                          className="w-full p-3 rounded-xl bg-black/40 border border-border-dim focus:border-accent-neon outline-none text-sm font-mono text-white"
                        />
                      </motion.div>
                    )}

                    {/* Photo Upload */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="specialist-label">04 // Ваше_Фото</label>
                        {userPhoto && (
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-mono font-bold text-accent-neon uppercase tracking-widest">AI_Гардероб</span>
                            <button 
                              onClick={() => setUseAiWardrobe(!useAiWardrobe)}
                              className={`w-10 h-5 rounded-full transition-colors relative ${useAiWardrobe ? 'bg-accent-neon' : 'bg-slate-800'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useAiWardrobe ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border border-dashed rounded-xl p-6 lg:p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                          userPhoto ? 'border-accent-neon bg-accent-neon/5' : 'border-border-dim hover:border-accent-neon hover:bg-white/5'
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handlePhotoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        {userPhoto ? (
                          <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-2xl border border-border-dim">
                            <img src={userPhoto} alt="Uploaded" className="w-full h-full object-cover" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); setUserPhoto(null); }}
                              className="absolute top-2 right-2 bg-black/80 rounded-full p-1.5 shadow-xl hover:bg-black transition-colors"
                            >
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-border-dim">
                              <Upload className="text-slate-500 w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="font-mono font-bold text-[10px] text-white uppercase tracking-widest">Завантажити_Фото</p>
                              <p className="text-[9px] font-mono text-slate-600 mt-2 uppercase">PNG, JPG // MAX 5MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Generate Button */}
                    <div className="pt-6">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={generateCarousel}
                        disabled={isGenerating}
                        className={`w-full py-5 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(99,102,241,0.2)] ${
                          isGenerating 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : 'bg-accent-neon text-white hover:bg-indigo-500 active:scale-[0.98]'
                        }`}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            ОБРОБКА_AI_ЛОГІКИ... {Math.round(progress)}%
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 fill-current" />
                            ЗАПУСТИТИ_ГЕНЕРАЦІЮ
                          </>
                        )}
                      </motion.button>

                      {error && (
                        <p className="mt-4 text-red-500 text-[10px] font-mono font-bold text-center flex items-center justify-center gap-2 uppercase tracking-widest">
                          <AlertCircle className="w-4 h-4" />
                          Error: {error}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ) : activeTab === 'clone' ? (
                  <motion.div
                    key="clone-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-accent-neon/40 rounded flex items-center justify-center">
                          <Users className="text-accent-neon w-3 h-3" />
                        </div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-white">AI_Цифровий_Двійник</h2>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[8px] font-mono font-bold uppercase tracking-widest ${cloneStatus === 'ready' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                        {cloneStatus === 'ready' ? 'Clone_Active' : 'Training_Required'}
                      </div>
                    </div>

                    <div className="bg-surface border border-border-dim rounded-3xl p-8 space-y-8">
                      <div className="space-y-4">
                        <h3 className="text-sm font-mono font-bold text-white uppercase tracking-widest">Навчання_Клона</h3>
                        <p className="text-[11px] font-mono text-slate-400 leading-relaxed uppercase">
                          Для створення точного AI-клона завантажте 3-5 фотографій з різних ракурсів. Це дозволить AI краще вивчити ваші риси обличчя.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {cloneData.photos.map((photo, idx) => (
                          <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-border-dim relative group">
                            <img src={photo} alt={`Clone ref ${idx}`} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setCloneData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                              className="absolute top-2 right-2 bg-black/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <AlertCircle className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        ))}
                        {cloneData.photos.length < 4 && (
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-xl border border-dashed border-border-dim flex flex-col items-center justify-center gap-2 hover:border-accent-neon hover:bg-white/5 transition-all"
                          >
                            <Upload className="w-5 h-5 text-slate-600" />
                            <span className="text-[8px] font-mono text-slate-600 uppercase">Додати_Фото</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="specialist-label">Профіль_Особистості</label>
                        <textarea 
                          value={cloneData.profile}
                          onChange={(e) => setCloneData(prev => ({ ...prev, profile: e.target.value }))}
                          placeholder="Опишіть себе (вік, стиль, особливості)..."
                          className="w-full p-4 rounded-xl bg-black/40 border border-border-dim focus:border-accent-neon outline-none text-sm font-mono text-white min-h-[100px]"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (cloneData.photos.length === 0) {
                            setError("Завантажте хоча б одне фото для навчання.");
                            return;
                          }
                          setIsTraining(true);
                          setCloneStatus('training');
                          // Simulate training process
                          await new Promise(r => setTimeout(r, 3000));
                          
                          // Final analysis
                          try {
                            const response = await callGemini({
                              model: "gemini-3-flash-preview",
                              contents: [
                                { text: "Based on these photos, provide a highly detailed physical description for AI image generation. Focus on facial structure, hair, eyes, and unique identifiers." },
                                ...cloneData.photos.map(p => ({ inlineData: { data: p.split(',')[1], mimeType: "image/png" } }))
                              ]
                            });
                            setCloneData(prev => ({ ...prev, profile: response?.text || prev.profile }));
                            setCloneStatus('ready');
                          } catch (err) {
                            console.error(err);
                            setCloneStatus('idle');
                          } finally {
                            setIsTraining(false);
                          }
                        }}
                        disabled={isTraining}
                        className={`w-full py-5 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-3 transition-all ${
                          isTraining ? 'bg-slate-800 text-slate-500' : 'bg-accent-neon text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]'
                        }`}
                      >
                        {isTraining ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            НАВЧАННЯ_НЕЙРОМЕРЕЖІ...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 fill-current" />
                            {cloneStatus === 'ready' ? 'ОНОВИТИ_КЛОНА' : 'ЗАПУСТИТИ_НАВЧАННЯ'}
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ) : activeTab === 'comms' ? (
                  <motion.div
                    key="comms-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col h-[calc(100vh-250px)]"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-5 h-5 border border-accent-neon/40 rounded flex items-center justify-center">
                        <MessageSquare className="text-accent-neon w-3 h-3" />
                      </div>
                      <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-white">AI_Комунікатор_v1.0</h2>
                    </div>

                    <div className="flex-1 bg-surface border border-border-dim rounded-3xl p-6 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-[11px] font-mono leading-relaxed tracking-tight ${
                              msg.role === 'user' 
                                ? 'bg-accent-neon text-white rounded-tr-none' 
                                : 'bg-white/5 text-slate-300 border border-white/10 rounded-tl-none'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {isChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin text-accent-neon" />
                              <span className="text-[10px] font-mono text-slate-500 uppercase">AI_Thinking...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <input 
                          type="text"
                          value={currentChatMessage}
                          onChange={(e) => setCurrentChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isChatLoading && currentChatMessage.trim()) {
                              const sendChat = async () => {
                                const userText = currentChatMessage.trim();
                                setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
                                setCurrentChatMessage('');
                                setIsChatLoading(true);

                                try {
                                  const response = await callGemini({
                                    model: "gemini-3-flash-preview",
                                    contents: [{ text: userText }],
                                    config: {
                                      systemInstruction: "Ти — експертний AI-асистент для MLM-підприємців. Твоя мета — допомагати з рекрутингом, продажами та побудовою команд. Відповідай коротко, професійно та в стилі 'high-tech'."
                                    }
                                  });
                                  setChatMessages(prev => [...prev, { role: 'ai', text: response?.text || 'Помилка зв\'язку.' }]);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsChatLoading(false);
                                }
                              };
                              sendChat();
                            }
                          }}
                          placeholder="Запитайте щось у AI..."
                          className="flex-1 bg-black/40 border border-border-dim rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-accent-neon outline-none"
                        />
                        <button 
                          onClick={async () => {
                            if (!currentChatMessage.trim() || isChatLoading) return;
                            const userText = currentChatMessage.trim();
                            setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
                            setCurrentChatMessage('');
                            setIsChatLoading(true);

                            try {
                              const response = await callGemini({
                                model: "gemini-3-flash-preview",
                                contents: [{ text: userText }],
                                config: {
                                  systemInstruction: "Ти — експертний AI-асистент для MLM-підприємців. Твоя мета — допомагати з рекрутингом, продажами та побудовою команд. Відповідай коротко, професійно та в стилі 'high-tech'."
                                }
                              });
                              setChatMessages(prev => [...prev, { role: 'ai', text: response?.text || 'Помилка зв\'язку.' }]);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setIsChatLoading(false);
                            }
                          }}
                          disabled={isChatLoading || !currentChatMessage.trim()}
                          className="bg-accent-neon text-white p-3 rounded-xl hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50"
                        >
                          <Zap className="w-5 h-5 fill-current" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="roadmap"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-12"
                  >
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold font-mono uppercase tracking-[0.3em] text-white">Дорожня_карта_платформи</h2>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Будуємо майбутнє автоматизації MLM</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ROADMAP_STEPS.map((step, index) => (
                        <motion.div
                          key={step.phase}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-6 lg:p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl relative group hover:border-accent-neon/30 transition-all"
                        >
                          <div className="absolute top-4 right-4 text-[7px] lg:text-[8px] font-bold font-mono uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-500">
                            {step.status}
                          </div>
                          
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-accent-neon/10 text-accent-neon flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            {step.icon}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="text-[9px] lg:text-[10px] font-bold font-mono text-accent-neon uppercase tracking-widest mb-1">{step.phase}</div>
                              <h3 className="text-base lg:text-lg font-bold font-mono text-white uppercase tracking-wider">{step.title}</h3>
                            </div>

                            <ul className="space-y-3">
                              {step.items.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-[9px] lg:text-[10px] font-medium text-slate-400 uppercase tracking-tight leading-relaxed">
                                  <div className="w-1 h-1 rounded-full bg-accent-neon mt-1.5 shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="p-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] text-center">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">
                        Більше інноваційних функцій незабаром. Слідкуйте за оновленнями.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Column: Preview Panel */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border-dim pb-4">
                <div className="flex items-center gap-6">
                  <div className="text-sm font-mono font-bold uppercase tracking-widest flex items-center gap-3 text-white">
                    <ImageIcon className="w-5 h-5 text-accent-neon" />
                    Слайди
                  </div>
                </div>
                {generatedSlides.length > 0 && (
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={exportToMake}
                      disabled={isExportingToMake}
                      className="text-accent-neon font-mono font-bold text-[10px] flex items-center gap-2 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50"
                    >
                      {isExportingToMake ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                      Make_AutoPost
                    </button>
                    <button 
                      onClick={downloadZip}
                      className="text-accent-cyan font-mono font-bold text-[10px] flex items-center gap-2 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      <Download className="w-4 h-4" />
                      Експорт
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div 
                  key="slides-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                    <div className="relative group">
                      <div className="aspect-square bg-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-border-dim ring-1 ring-white/5">
                    <AnimatePresence mode="wait">
                      {generatedSlides.length > 0 ? (
                        <motion.div
                          key={currentSlideIndex}
                          initial={{ opacity: 0, x: 40, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -40, scale: 1.05 }}
                          transition={{ 
                            type: "spring", 
                            damping: 25, 
                            stiffness: 120,
                            opacity: { duration: 0.3 }
                          }}
                          className="w-full h-full relative"
                        >
                          <img 
                            src={generatedSlides[currentSlideIndex].imageUrl} 
                            alt={`Slide ${currentSlideIndex + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="absolute top-6 right-6 bg-black/70 backdrop-blur-md text-white px-4 py-1.5 rounded-lg text-[10px] font-mono font-bold border border-white/10"
                          >
                            SLIDE_{currentSlideIndex + 1} // 08
                          </motion.div>
                          
                          {/* Regenerate Button Overlay */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 w-full px-8 flex flex-col items-center gap-4">
                            <div className="w-full max-w-xs bg-black/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-2">
                              <input 
                                type="text"
                                value={regenInstructions}
                                onChange={(e) => setRegenInstructions(e.target.value)}
                                placeholder="Що змінити? (наприклад: інший одяг, яскравіше світло...)"
                                className="flex-1 bg-transparent border-none outline-none text-[10px] font-mono text-white placeholder:text-slate-500"
                              />
                              {regenInstructions && (
                                <button 
                                  onClick={() => setRegenInstructions('')}
                                  className="text-slate-500 hover:text-white transition-colors"
                                >
                                  <AlertCircle className="w-3 h-3 rotate-45" />
                                </button>
                              )}
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => regenerateSlide(currentSlideIndex)}
                              disabled={isRegeneratingSlide !== null}
                              className="bg-white text-black px-8 py-3 rounded-xl text-[10px] font-mono font-bold shadow-2xl flex items-center gap-3 hover:bg-accent-cyan transition-all"
                            >
                              {isRegeneratingSlide === currentSlideIndex ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Zap className="w-4 h-4 fill-current text-indigo-600" />
                              )}
                              RE-GENERATE_IMAGE
                            </motion.button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-full h-full flex flex-col items-center justify-center p-12 text-center text-slate-600 space-y-6"
                        >
                          <motion.div 
                            animate={{ 
                              y: [0, -10, 0],
                              rotate: [0, 5, -5, 0]
                            }}
                            transition={{ 
                              duration: 4, 
                              repeat: Infinity, 
                              ease: "easeInOut" 
                            }}
                            className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-border-dim"
                          >
                            <ImageIcon className="w-12 h-12" />
                          </motion.div>
                          <div className="space-y-2">
                            <p className="font-mono font-bold text-[11px] text-white uppercase tracking-[0.2em]">Buffer_Empty</p>
                            <p className="text-[10px] font-mono leading-relaxed uppercase tracking-widest opacity-60">Initialize generation sequence to populate output buffer.</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Navigation Arrows */}
                  {generatedSlides.length > 0 && (
                    <>
                      <button 
                        onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentSlideIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/80 backdrop-blur-md rounded-xl shadow-2xl flex items-center justify-center text-white hover:bg-accent-neon disabled:opacity-0 transition-all border border-white/10"
                      >
                        <ChevronLeft className="w-7 h-7" />
                      </button>
                      <button 
                        onClick={() => setCurrentSlideIndex(prev => Math.min(generatedSlides.length - 1, prev + 1))}
                        disabled={currentSlideIndex === generatedSlides.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/80 backdrop-blur-md rounded-xl shadow-2xl flex items-center justify-center text-white hover:bg-accent-neon disabled:opacity-0 transition-all border border-white/10"
                      >
                        <ChevronRight className="w-7 h-7" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {generatedSlides.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                      {generatedSlides.map((slide, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setCurrentSlideIndex(idx)}
                          className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                            currentSlideIndex === idx ? 'border-accent-neon scale-110 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'border-border-dim opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                          }`}
                        >
                          <img src={slide.imageUrl} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
          </AnimatePresence>

              {/* Feature List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface p-5 rounded-xl border border-border-dim flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-green-500/20">
                    <TextIcon className="text-green-500 w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Viral_Copy</p>
                    <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase">LLM_Optimized_Hooks</p>
                  </div>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border-dim flex items-start gap-4">
                  <div className="w-10 h-10 bg-accent-cyan/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-accent-cyan/20">
                    <Palette className="text-accent-cyan w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Design_Logic</p>
                    <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase">Visual_Hierarchy_v2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-20 py-10 lg:py-16 border-t border-border-dim text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 opacity-30 grayscale">
                <Zap className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">MLM_AI_Platform</span>
              </div>
              <p className="text-slate-600 font-mono text-[9px] uppercase tracking-widest px-4">© 2026 // Платформа для автоматизації MLM бізнесу</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
