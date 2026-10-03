#!/usr/bin/env bash
# One command to get Perch running in Expo Go from a GitHub Codespace (works from an iPad).
# First run: EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm run ipad
# It saves those to .env, then prints an exp:// link. In Expo Go, "Enter URL manually", paste it.
set -e
cd "$(dirname "$0")/.."
if [ -n "$EXPO_PUBLIC_SUPABASE_URL" ] && [ -n "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
  printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$EXPO_PUBLIC_SUPABASE_URL" "$EXPO_PUBLIC_SUPABASE_ANON_KEY" > .env
fi
if ! grep -q "supabase.co" .env 2>/dev/null; then
  echo "No .env yet. Run once with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY set (see README)."; exit 1
fi
export CI=1
npx expo start --tunnel
