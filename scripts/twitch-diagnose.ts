import 'dotenv/config';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';
import { getBroadcasterAccessToken } from '../lib/twitch-oauth';

type DiagnosisResult = {
  name: string;
  ok: boolean;
  status: number;
  bodySnippet?: string;
  error?: unknown;
};

const BROADCASTER_ID = env.TWITCH_BROADCASTER_ID;
const CLIENT_ID = env.TWITCH_CLIENT_ID;

async function testEndpoint(
  url: string,
  token: string,
  name: string,
): Promise<DiagnosisResult> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': CLIENT_ID,
      },
    });

    const text = await response.text();
    const ok = response.ok;

    return {
      name,
      ok,
      status: response.status,
      bodySnippet: text.slice(0, 300),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: -1,
      error,
    };
  }
}

async function diagnose() {
  console.log('Starting Twitch diagnostics...\n');

  try {
    const token = await getBroadcasterAccessToken();
    console.log('✓ Obtained broadcaster access token\n');

    const endpoints = [
      {
        name: 'Followers endpoint (channels/followers)',
        url: `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}&first=1`,
      },
      {
        name: 'Subscriptions endpoint (subscriptions)',
        url: `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${BROADCASTER_ID}&first=1`,
      },
    ];

    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint.url, token, endpoint.name);

      if (result.ok) {
        console.log(`✓ ${result.name} reachable (status ${result.status})`);
      } else {
        console.error(`✗ ${result.name} failed (status ${result.status})`);

        if (result.bodySnippet) {
          console.error(`  Response: ${result.bodySnippet}`);
        }
        if (result.error) {
          console.error('  Error:', result.error);
        }
      }
    }
  } catch (error) {
    console.error('Fatal error during Twitch diagnostics:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

diagnose();
