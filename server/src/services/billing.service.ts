import razorpay from './razorpay.service.js';

export async function createSubscription(planId: string, userId: string) {
  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 12,
    notes: { userId },
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return razorpay.subscriptions.cancel(subscriptionId);
}

export async function fetchSubscription(subscriptionId: string) {
  return razorpay.subscriptions.fetch(subscriptionId);
}
