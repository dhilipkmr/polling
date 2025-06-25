import dotenv from 'dotenv';
dotenv.config();

export async function sendNotification(message = "") {
    try {
      const telegramUrl = `https://api.telegram.org/bot${process.env.BOT_ID}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: process.env.CHAT_ID,
          text: message,
          parse_mode: "HTML"
        }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send Telegram notification:', error.message);
      throw error;
    }
  }