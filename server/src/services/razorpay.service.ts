import Razorpay from 'razorpay';

let _instance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_instance) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      throw new Error(
        '[Razorpay] RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables.'
      );
    }

    _instance = new Razorpay({ key_id, key_secret });
  }
  return _instance;
}

export default getRazorpay;
