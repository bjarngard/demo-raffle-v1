'use client'

import { useState } from 'react'
import LegalModal from './LegalModal'

const PRIVACY_POLICY = `Privacy Policy – Bossfight Demo Raffle

1. Who we are
Bossfight Demo Raffle is operated by:
Erik Bjärngard (“Bossfight”)
Contact: bossfightswe@gmail.com

I am based in Sweden and act as the data controller for the personal data processed through this application.

2. What data I collect

When you use the raffle app (including logging in with Twitch), the system may process the following categories of data:

• Twitch account data:
  – Twitch user ID
  – Display name and username
  – Profile image URL

• Raffle and support data:
  – Your raffle entries (demo link, notes, timestamps)
  – Your current and historical raffle weights (base weight, carry-over weight, and weight from follows, subscriptions, gifted subs and bits)
  – Session participation (which raffle sessions you have joined, whether you have won, etc.)

• Technical data:
  – IP address and basic connection metadata as logged by the hosting providers
  – Browser / device information (user agent)
  – Server logs for debugging and security purposes

No sensitive categories of personal data are intentionally collected.

3. Why this data is collected (purposes)

I process this data in order to:

• Run the raffle mechanic in a fair and transparent way
• Calculate and display your current raffle weight and winning chance
• Detect obvious abuse or cheating and protect the service from misuse
• Improve the app’s performance and stability (via logs and technical metrics)
• Communicate with you if there are issues related to a raffle entry or a prize

4. Legal bases (for users in the EU/EEA)

For users in the EU/EEA (including Sweden), personal data is processed mainly on the following legal bases under GDPR:

• Performance of a contract (Article 6(1)(b)):
  To provide the raffle functionality once you choose to log in and participate.

• Legitimate interests (Article 6(1)(f)):
  To run, protect and improve the app, prevent abuse and maintain a fair experience for all users.
  These interests are balanced against your privacy rights.

If I ever rely on consent for specific optional features, that consent will be requested separately.

5. How long data is kept

Data is kept for as long as reasonably necessary to:

• Provide the raffle functionality
• Maintain a basic history of past sessions and winners
• Monitor and secure the app

Over time I may introduce automatic cleanup of old or inactive data (for example, users who have not participated for a long period). When that happens, this policy will be updated to reflect it.

You can always request that I delete your data sooner (see “Your rights” below).

6. Where and how the data is stored

The app is hosted using third-party providers, for example:

• Supabase (database) – EU region
• Vercel (hosting) – EU region

These providers store and process data on my behalf in accordance with their own security and privacy standards. I do not sell your personal data to third parties.

7. Sharing of data

I do not sell or rent your personal data.

Data may be shared with:

• Service providers that help run the app (e.g. hosting, database, logging)
• Twitch, to the extent required for authentication and to comply with Twitch’s API and terms

Data may also be disclosed if required by applicable law or authorities.

8. Your rights (EU/EEA)

If you are in the EU/EEA, you have the right to:

• Access your personal data
• Request correction of inaccurate data
• Request deletion of your data (where legally possible)
• Object to certain processing based on legitimate interests
• Lodge a complaint with your local data protection authority

To exercise these rights, contact me at: bossfightswe@gmail.com

9. Changes to this policy

This Privacy Policy may be updated over time. The latest version will always be available through the link in the app footer.`

const RAFFLE_RULES = `Raffle Rules – Bossfight Demo Raffle

1. Overview

Bossfight Demo Raffle is a viewer raffle used during livestreams and related content by “Bossfight” (Erik Bjärngard).
The purpose is to randomly select demos for feedback or other non-cash rewards.
By participating in the raffle, you agree to these rules.

2. No purchase required

You do not need to pay money to participate.
Support (such as follows, subscriptions, gifted subs or bits) may give you extra raffle weight, but there is always a base weight available to regular viewers who join without paying.

3. How entries and weights work

• You log in with Twitch to join the raffle.
• You can submit a demo link and any required information during an active session.
• Each participant has a “weight” that represents their chance to be picked in that session.
• Your total weight can come from:
  – A base weight for participating
  – Loyalty or carry-over weight from past sessions
  – Support actions (follows, subs, gifted subs, bits), according to the current configuration
• The exact weight configuration can change over time to keep the system balanced and fair.

4. How winners are chosen

• Winners are chosen using a weighted random draw.
• The probability of being picked is based on your total weight divided by the total weight of all participants in the active session.
• The app shows a best-effort view of your current weight and winning chance.
• Due to technical issues, network problems or bugs, there is no absolute guarantee that the app will always behave perfectly, but the clear intention is to run it fairly.

5. Prizes and limitations

• The raffle is mainly intended to select demos for listening/feedback or similar non-cash rewards.
• Any additional prize or benefit will be communicated clearly in the stream or description.
• Prizes are not transferable or redeemable for cash unless explicitly stated.

6. Eligibility

• By participating, you confirm that:
  – You comply with Twitch’s Terms of Service and community guidelines.
  – Your submitted content (demos, links, text) does not contain illegal, hateful or otherwise harmful material.
• I reserve the right to remove entries or exclude participants who:
  – Abuse the system or attempt to cheat
  – Harass others or violate basic community standards
  – Submit content that is clearly inappropriate or dangerous

7. Technical limitations and disclaimers

• The raffle depends on third-party services (Twitch, hosting providers, etc.).
• I cannot guarantee uninterrupted access or error-free operation.
• If there is a serious bug, outage or other issue, I may:
  – Cancel a session
  – Re-run a draw
  – Manually adjust entries or results
  – Or otherwise correct the situation in a way that is reasonably fair.

8. Changes to rules

These rules may be updated or adjusted over time.
The version linked in the app footer is the one that applies for the current sessions.

9. Contact

If you have questions or concerns about the raffle or its rules, contact:
bossfightswe@gmail.com`

export default function LegalFooter() {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showRules, setShowRules] = useState(false)

  return (
    <footer className="mt-16 mb-10 pb-10 pt-4 text-center text-xs text-gray-500 dark:text-gray-400 px-4 bg-transparent">
      <p className="space-x-2">
        <span>Bossfight Demo Raffle</span>
        <span>·</span>
        <span>Operated by Erik Bjärngard</span>
        <span>·</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setShowRules(true)
          }}
          className="underline hover:text-gray-300"
        >
          Rules &amp; Terms
        </a>
        <span>·</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setShowPrivacy(true)
          }}
          className="underline hover:text-gray-300"
        >
          Privacy Policy
        </a>
      </p>

      {showPrivacy && (
        <LegalModal
          title="Privacy Policy"
          content={PRIVACY_POLICY}
          onClose={() => setShowPrivacy(false)}
        />
      )}

      {showRules && (
        <LegalModal
          title="Raffle Rules"
          content={RAFFLE_RULES}
          onClose={() => setShowRules(false)}
        />
      )}
    </footer>
  )
}

