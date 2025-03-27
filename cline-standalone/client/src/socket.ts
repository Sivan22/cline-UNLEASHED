import { io } from 'socket.io-client';

// Create socket connection
const socketUrl = process.env.NODE_ENV === 'production' 
  ? window.location.origin  // Use the same host in production
  : 'http://localhost:8080'; // Use localhost in development

export const socket = io(socketUrl);

// Event listeners for connection status
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Helper function to emit events with Promise-based responses
export const emitWithPromise = <T>(event: string, data?: any): Promise<T> => {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
};
