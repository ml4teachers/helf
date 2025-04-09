'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'

interface AudioRecorderProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function AudioRecorder({ onTranscription, disabled = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [processingAudio, setProcessingAudio] = useState(false)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  // Check microphone permission status on component mount
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt');
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setMicPermission(result.state as 'granted' | 'denied' | 'prompt');
        });
      } catch (error) {
        console.error('Error checking microphone permission:', error);
      }
    };
    
    checkMicrophonePermission();
  }, []);

  const startRecording = async () => {
    try {
      // Request permission if needed
      if (micPermission === 'denied') {
        alert('Microphone access is required to use this feature. Please enable microphone access in your browser settings.');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Update permission status after successful access
      setMicPermission('granted');
      
      // Check which MIME types are supported by the browser
      const getMimeType = () => {
        const types = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/mp4'
        ];
        
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            return type;
          }
        }
        
        // Fallback: use default MIME type
        return '';
      };
      
      // Create recorder with supported MIME type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: getMimeType()
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Register the dataavailable event to capture audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes`);
        }
      };
      
      // Request data every 2 seconds to avoid losing chunks
      const dataInterval = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.requestData();
          } catch (e) {
            console.warn('Could not request data from MediaRecorder:', e);
          }
        }
      }, 2000);

      mediaRecorder.onstart = () => {
        setIsRecording(true);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setProcessingAudio(true);
        
        try {
          // Clear the data request interval when recording stops
          clearInterval(dataInterval);
          
          // Use the same MIME type that was selected for recording
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          
          // Small delay to ensure the final data is captured
          await new Promise(resolve => setTimeout(resolve, 200));
          
          console.log(`Total chunks: ${audioChunksRef.current.length}, Combined size: ${
            audioChunksRef.current.reduce((total, chunk) => total + chunk.size, 0)
          } bytes`);
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log(`Final blob size: ${audioBlob.size} bytes`);
          
          await transcribeAudio(audioBlob);
        } catch (error) {
          console.error('Error handling recorded audio:', error);
        } finally {
          setProcessingAudio(false);
          
          // Stop all tracks of the stream to release the microphone
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // Start recording
      mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      
      // If permission was denied
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setMicPermission('denied');
        alert('Microphone access was denied. Please enable microphone access in your browser settings to use this feature.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      // Ensure we're setting a string value
      const transcribedText = typeof data.text === 'string' ? data.text : '';
      onTranscription(transcribedText);
    } catch (error) {
      console.error('Error transcribing audio:', error);
    }
  };

  return (
    <Button 
      type="button" 
      variant={isRecording ? "destructive" : "ghost"}
      size="icon" 
      disabled={disabled || processingAudio}
      onClick={isRecording ? stopRecording : startRecording}
      className="rounded-full transition-colors"
    >
      {isRecording ? (
        <MicOff className="h-5 w-5 animate-pulse" />
      ) : processingAudio ? (
        <span className="h-5 w-5 rounded-full animate-pulse bg-primary/50" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}