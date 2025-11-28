# Twitch Integration Setup Guide

This application now supports Twitch OAuth login with automatic weight calculation based on user engagement.

## Features

- **Twitch OAuth Login**: Users can sign in with their Twitch account
- **Automatic Weight Calculation**: Weights are calculated based on:
  - Subscription status and months subscribed
  - Resubscriptions
  - Bits cheered
  - Donations
  - Carry-over weight from previous streams
- **Real-time Updates**: Via Twitch EventSub webhooks (subscription, resub, cheer events)
- **Weighted Winner Selection**: Winners are selected using weighted random selection

## Required Environment Variables

Add these to your `.env` file:

```env
# Twitch OAuth
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_BROADCASTER_ID=your_broadcaster_user_id

# Twitch Webhook (for real-time events)
TWITCH_WEBHOOK_SECRET=your_webhook_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Database (existing)
DATABASE_URL=your_database_url

# Admin (existing)
ADMIN_TOKEN=your_admin_token
```

## Getting Twitch Credentials

### 1. Create a Twitch Application

1. Go to https://dev.twitch.tv/console
2. Click "Register Your Application"
3. Fill in:
   - **Name**: Your app name (e.g., "My Raffle App")
   - **OAuth Redirect URLs**: `http://localhost:3000/api/auth/callback/twitch` (and your production URL)
   - **Category**: Choose appropriate category
4. Click "Create"
5. Copy your **Client ID** and create a **Client Secret**

### 2. Get Your Broadcaster ID

1. Go to https://dev.twitch.tv/docs/api/reference#get-users
2. Use the Twitch API or a tool to get your user ID
3. Or use: `https://api.twitch.tv/helix/users?login=YOUR_USERNAME`
   (requires authentication)

### 3. Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

## Setting Up Twitch EventSub Webhooks (Real-time Updates)

The webhook handler is fully compliant with [Twitch's EventSub documentation](https://dev.twitch.tv/docs/eventsub/handling-webhook-events).

### Security Features

- **HMAC-SHA256 Signature Verification**: All events are verified using timing-safe comparison
- **Timestamp Verification**: Prevents replay attacks by rejecting events older than 10 minutes
- **Duplicate Detection**: Tracks processed events to prevent processing the same event twice

### Supported Events

1. Go to https://dev.twitch.tv/console/webhooks
2. Subscribe to events (with required scopes):
   - `channel.subscribe` (scope: `channel:read:subscriptions`) - New subscriptions
   - `channel.subscription.message` (scope: `channel:read:subscriptions`) - Resubs with cumulative months
   - `channel.subscription.gift` (scope: `channel:read:subscriptions`) - Gifted subscriptions
   - `channel.cheer` (scope: `bits:read`) - Bits cheered
   - `channel.follow` (requires broadcaster + moderator condition) - New followers
3. Set callback URL to: `https://yourdomain.com/api/twitch/webhook`
4. Copy the webhook secret and add it to `TWITCH_WEBHOOK_SECRET`

### Webhook Handler Features

- **Automatic Verification**: Handles `webhook_callback_verification` challenges automatically
- **Revocation Handling**: Handles subscription revocations gracefully
- **Fast Response**: Returns 2XX status codes quickly to meet Twitch's requirements
- **Error Resilience**: Continues processing even if individual events fail

**Note**: For local development, use a tool like ngrok to expose your local server publicly.

### Testing with Twitch CLI

You can test your webhook handler using the Twitch CLI:

```bash
# Test challenge verification
twitch event verify-subscription subscribe -F http://localhost:3000/api/twitch/webhook -s YOUR_SECRET

# Test notification events
twitch event trigger subscribe -F http://localhost:3000/api/twitch/webhook -s YOUR_SECRET
```

## Weight Calculation Formula

Current weight formula:

```
baseWeight = 1.0
subWeight = subMonths * 0.1
resubWeight = resubCount * 0.2
cheerWeight = min(totalCheerBits / 1000, 5.0)
donationWeight = min(totalDonations / 1000, 5.0)
carryOverWeight = previousWeight * 0.5 (if didn't win)

totalWeight = baseWeight + subWeight + resubWeight + cheerWeight + donationWeight + carryOverWeight
```

## API Endpoints

### Application Routes

- `POST /api/twitch/sync` - Sync user's Twitch data (called automatically)
- `POST /api/twitch/update-weights` - Update all user weights
- `POST /api/twitch/webhook` - Twitch EventSub webhook endpoint
- `POST /api/twitch/carry-over` - Carry over weights to next stream

### Twitch API Endpoints Used

**REST (Helix):**
- `GET /helix/users` - Get user info (user token, scope: `user:read:email`)
- `GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>` - Check if user follows channel (broadcaster token, scope: `moderator:read:followers`)
- `GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>` - Get user subscription (broadcaster token, scope: `channel:read:subscriptions`)

**EventSub (Real-time):**
- `channel.subscribe` - New subscription (first month)
- `channel.subscription.message` - Resub with cumulative months
- `channel.subscription.gift` - Gift subscriptions
- `channel.cheer` - Bits cheered
- `channel.follow` - New follower

### Authentication

The application uses two types of tokens:

1. **User Token** (OAuth): Used for fetching user's own info
   - Scope: `user:read:email`
   - Obtained via NextAuth OAuth flow

2. **Broadcaster Token** (Client Credentials): Used for checking follows/subs
   - Scopes: `channel:read:subscriptions moderator:read:followers bits:read`
   - Obtained automatically via client credentials grant
   - Cached and refreshed as needed

## Usage Flow

1. User clicks "Sign in with Twitch" on the raffle page
2. User authorizes the application
3. User data is fetched from Twitch API (subscription info, etc.)
4. User's weight is calculated automatically
5. When user enters raffle, their entry is linked to their Twitch account
6. Winner selection uses weighted random selection
7. After winner is selected, non-winners get carry-over weight for next stream

## Testing Locally

1. Make sure all environment variables are set
2. Run `npm run dev`
3. Visit `http://localhost:3000`
4. Click "Sign in with Twitch"
5. Authorize the app
6. Your weight will be displayed automatically

## Troubleshooting

**Error: "Invalid client"**
- Check that `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are correct
- Verify redirect URL matches in Twitch console

**Error: "Failed to fetch subscription"**
- Ensure `TWITCH_BROADCASTER_ID` is set correctly
- Check that the broadcaster ID is the actual user ID (not username)

**Webhooks not working**
- Verify webhook URL is publicly accessible (use ngrok for local testing)
- Check that `TWITCH_WEBHOOK_SECRET` matches in webhook subscription
- Ensure webhook subscription is verified in Twitch console
- Check server logs for signature verification errors
- Verify that your server responds within a few seconds (Twitch times out slow responses)

**Duplicate events**
- The system automatically tracks processed events to prevent duplicates
- If you see duplicates, check the `ProcessedWebhookEvent` table in your database

**Signature verification failing**
- Ensure `TWITCH_WEBHOOK_SECRET` is exactly the same as configured in Twitch console
- Secret must be 10-100 characters long (ASCII string)
- Verify you're using the correct secret for each subscription

