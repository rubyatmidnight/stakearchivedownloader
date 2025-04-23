# Stake Game Archive Downloader Tool


Updated 4/23/2025

This tool has been updated and made a lot easier for anyone to use; I haven't verified whether it's usable on mobile (or safari) yet! It should be. For mobile, follow exactly the same steps; you can still download extensions to your mobile browser.

This tool now uses [Tampermonkey](https://www.tampermonkey.net/) for ease of use, please download the Tampermonkey extension for your browser:

[Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

[Chrome/Edge](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

[Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)

---

## Instructions

1. Install Tampermonkey (see download links above).

2. Open the Tampermonkey dashboard

3. Click 'create a new script' (the boxed + symbol in the tabs next to settings)

4. Paste the entirety of the archivedownloader.js code in, and enable it.

5. Open to your game archive: [Stake.us](https://stake.us/transactions/archive) / [Stake.com](https://stake.com/transactions/archive) / Or any mirror site: https://stake.*/transactions/archive

5a. Optional: Disable the downloading flyout window when a new download is started in your browser settings; as it will be downloading all your archives, and will pop up every time. This may not be possible on Firefox, but on Chrome, you can disable 'show downloads when they're done' in the browser settings. Alternatively, just leave for a few minutes.

6. You should see a little popup window in the bottom right of your screen while on any of the Stake websites. While on the game archives page 1, just click start. It will move through each page and download until it reaches the end of the archives. 

7. Wait...

8. Once it's done, disable the script in Tampermonkey, or disable Tampermonkey altogether. This only needs to run once, and then you can enable it again in the future if you need to download them further. You now have every bet archive for that account downloaded, and renamed to be the date of the archive. 

---

## Use-cases

What are these useful for? These contain all the bets you have made in json. They can be verified for validity, or used to build histories for your gameplay. 

Stake Stats has a bet archive organizer and downloader that anyone can use, even without a subscription. 

[Stake Stats bet archive analyzer](https://stakestats.net/stake/tools/betarchive)

![image](https://github.com/user-attachments/assets/6fbd544a-a4f5-4d49-8452-da01d159065f)


Additionally, for power users who may want to process the downloads themselves, there is the urltool.js which will output a list of the download urls, rather than actually downloading from those urls. You do not need to use that if you don't know how. 

## Issues/Errors

If it's saying the fetch failed, then it's not retrieving the correct URL from the page you're on. Ensure that you're on the correct page (stake.*/transactions/archive), and if that fails but you can still see the popup, click the cog button on the window and set the 'preferred domain' to be the one you want. It should work after that.

If it still doesn't work, open an issue in the github and tell me what it's doing or where it fails.

- rubyatmidnight

If this was useful to you, here is my LTC address: 
ltc: `LUUcDEtCA4XEomX8JBAcu7eVB2Ko6wY5gW`

Or consider [Stake Stats Premium](https://stakestats.net/stake/offers) for faster processing of your files. 
