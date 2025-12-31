'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProcessingStep {
  id: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  duration?: number; // Expected duration in seconds
}

interface InvoiceProcessingLoaderProps {
  steps: ProcessingStep[];
  className?: string;
}

const AnimatedDots = ({ isActive }: { isActive: boolean }) => {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setDotIndex(prev => (prev + 1) % 3);
    }, 500);
    
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex space-x-1 ml-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300",
            index <= dotIndex 
              ? "bg-blue-500 scale-100 opacity-100" 
              : "bg-gray-300 scale-75 opacity-50"
          )}
        />
      ))}
    </div>
  );
};

const ProcessingWave = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="bg-gradient-to-t from-blue-400 to-blue-600 rounded-full opacity-70"
          style={{
            width: '3px',
            height: `${Math.random() * 20 + 5}px`,
            animation: `wave 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.3); }
        }
      `}</style>
    </div>
  );
};

const ProgressRing = ({ 
  progress, 
  size = 80, 
  strokeWidth = 6,
  className 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  className?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold text-gray-700">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export function InvoiceProcessingLoader({ steps, className }: InvoiceProcessingLoaderProps) {
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);

  // Calculate overall progress
  useEffect(() => {
    const completed = steps.filter(step => step.status === 'completed').length;
    const processing = steps.filter(step => step.status === 'processing').length;
    const total = steps.length;
    
    const progress = (completed / total) * 100 + (processing / total) * 25; // Give partial credit for processing
    setOverallProgress(Math.min(progress, 100));

    // Set current step
    const processingStep = steps.find(step => step.status === 'processing');
    setCurrentStep(processingStep?.id || null);
  }, [steps]);

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return (
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'processing':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 bg-white rounded-full animate-ping opacity-75"></div>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          </div>
        );
    }
  };

  const isProcessing = steps.some(step => step.status === 'processing');
  const hasError = steps.some(step => step.status === 'error');
  const isCompleted = steps.every(step => step.status === 'completed');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Progress Section */}
      <div className="flex flex-col items-center space-y-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl border border-blue-200">
        <div className="flex items-center space-x-6">
          <ProgressRing progress={overallProgress} />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-1">
              {isCompleted ? '🎉 Processing Complete!' : 
               hasError ? '⚠️ Processing Error' :
               isProcessing ? '🤖 AI Processing Invoice...' : 
               '⏳ Ready to Process'}
            </h3>
            <p className="text-gray-600">
              {isCompleted ? 'Your invoice has been analyzed successfully' :
               hasError ? 'Something went wrong during processing' :
               isProcessing ? 'Using Claude Vision AI for intelligent analysis' :
               'Upload an invoice to get started'}
            </p>
          </div>
        </div>
        
        {/* SoundCloud-style animated wave when processing */}
        {isProcessing && (
          <div className="flex items-center space-x-2 bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="text-sm font-medium text-blue-700">Analyzing</span>
            <ProcessingWave isActive={true} />
          </div>
        )}
      </div>

      {/* Detailed Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCurrentStep = step.status === 'processing';
          const isCompleted = step.status === 'completed';
          const hasError = step.status === 'error';
          
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start space-x-4 p-4 rounded-xl transition-all duration-300 border",
                isCurrentStep && "bg-blue-50 border-blue-200 shadow-md scale-[1.02]",
                isCompleted && "bg-green-50 border-green-200",
                hasError && "bg-red-50 border-red-200",
                step.status === 'pending' && "bg-gray-50 border-gray-200"
              )}
            >
              {/* Step Icon */}
              <div className="flex-shrink-0 mt-1">
                {getStepIcon(step)}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <h4 className={cn(
                    "font-medium text-sm",
                    isCompleted && "text-green-700",
                    hasError && "text-red-700",
                    isCurrentStep && "text-blue-700",
                    step.status === 'pending' && "text-gray-500"
                  )}>
                    {step.title}
                  </h4>
                  <AnimatedDots isActive={isCurrentStep} />
                </div>
                
                {step.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{step.subtitle}</p>
                )}
                
                {step.message && (
                  <p className={cn(
                    "text-xs mt-2",
                    hasError ? "text-red-600" : "text-gray-600"
                  )}>
                    {step.message}
                  </p>
                )}

                {/* Progress bar for current step */}
                {isCurrentStep && (
                  <div className="mt-3">
                    <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Connection line to next step */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 mt-10 w-0.5 h-6 bg-gray-200"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Messages */}
      {isCompleted && (
        <div className="p-4 bg-green-100 border border-green-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-medium text-green-800">Success!</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            Invoice processed successfully. Redirecting to review page...
          </p>
        </div>
      )}

      {hasError && (
        <div className="p-4 bg-red-100 border border-red-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="font-medium text-red-800">Processing Failed</span>
          </div>
          <p className="text-red-700 text-sm mt-1">
            Please try again or contact support if the issue persists.
          </p>
        </div>
      )}
    </div>
  );
}