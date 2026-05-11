const fs = require('fs');
const path = 'Mobile/src/app/services/ussd.service.ts';
let code = fs.readFileSync(path, 'utf8');

const newFunc = `import { VoiceIntentProcessor } from './engine/VoiceIntentProcessor';

export async function executeVoiceCommand(
  intent: string,
  data?: {
    amount?: number;
    recipient?: string;
  }
): Promise<{ success: boolean; message: string; action: string }> {
  console.log('🎙️ [USSD] Exécution via VoiceIntentProcessor:', intent, data);
  const processor = new VoiceIntentProcessor();
  
  try {
    const result = await processor.processIntent({ intent, amount: data?.amount, recipient: data?.recipient });
    
    if (result && (result as any).status === 'error') {
       return { success: false, message: (result as any).message, action: intent };
    }
    
    return {
      success: true,
      message: 'Transaction en cours en arrière-plan...',
      action: intent
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur inconnue',
      action: intent
    };
  }
}
`;

code = code.replace(/export async function executeVoiceCommand\([\s\S]*\}\n/m, newFunc + '\n');
fs.writeFileSync(path, code);
