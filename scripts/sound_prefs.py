"""Shared preference seeding for the audio checks.

Sound now starts off, so every script that asserts an audible voice opts in
before the app boots. Only writes when the profile has no v2 record, so a
script can still test the migration by removing the key first.
"""

AUDIO_ON = """
try {
  if (!localStorage.getItem('jsb.prefs.v2')) {
    localStorage.setItem('jsb.prefs.v2', JSON.stringify(
      { sound: true, haptics: true, soundHintDismissed: true }));
  }
} catch (error) {}
"""
