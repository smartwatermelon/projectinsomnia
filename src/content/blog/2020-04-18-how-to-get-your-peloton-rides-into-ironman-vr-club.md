---
title: "HOW TO GET YOUR PELOTON RIDES INTO IRONMAN VR CLUB"
date: 2020-04-18
description: "SportHeroes’ application security failures impact IRONMAN VR Club participants"
tags: ["blog", "tech", "triathlon"]
mediumUrl: "https://medium.com/@smartwatermelon/how-to-get-your-peloton-rides-into-ironman-vr-club-b344511b6f62"
---

### How to get your Peloton rides into IRONMAN VR Club

#### SportHeroes’ application security failures impact IRONMAN VR Club participants

**Update 2020–04–27:** SportHeroes have fixed a separate issue with their FitBit integration. If you have or want to create a FitBit account (you don’t need a FitBit device to create an account), you can share your Peloton rides to FitBit and link it to SportHeroes. This allows your Peloton rides to show up immediately in the IRONMAN VR Club dashboard with no exporting or editing needed!

Thanks to Paul-Emile at SportHeroes for reaching out personally about this issue.

**Update 2020–04–21:** I’ve narrowed down the specific incompatibility between activities originating on Peloton and auto-synced to Strava which prevents them from successfully importing to Garmin Connect.

1. Complete your Peloton ride and auto-sync it to Strava.
2. On your computer, export the Strava activity to TCX. Open the TCX in an editor like Notepad or TextEdit. Look for this section:  

```
    `<Creator><Name>PELOTON</Name></Creator>`
3.  Change it to:  
     `<Creator xsi:type=”Device_t”>    <Name>Garmin Forerunner 920XT</Name>    <UnitId>12345678</UnitId>    <ProductID>1765</ProductID>    <Version>    <VersionMajor>1</VersionMajor>    <VersionMinor>1</VersionMinor>    <BuildMajor>1</BuildMajor>    <BuildMinor>1</BuildMinor>    </Version>    </Creator>`
4.  Save the TCX file. You don’t need to run it through GOTOES. You should now be able to import it into Garmin Connect, and SportHeroes should automatically pick it up and credit your ride.
```

**Note:** You can try other Garmin device types besides `Forerunner 920XT`. That’s the device I have, so it’s the one I used here. Your results may vary.

I’m not going to rehash the whole [Strava vs. SportHeroes tiff](https://www.dcrainmaker.com/2020/04/strava-cuts-off-ironman-virtual-club-an-explainer-to-sports-tech-drama.html). It’s boring, and it doesn’t matter to us, the athletes (just like when cable companies and TV networks fight: the only one who loses is the consumer).

What I _am_ going to do is present a method you can use to get your Peloton rides out of Strava and into the IRONMAN VR Club platform (operated by SportHeroes) in a way that lets the activities count. No more “manual additions” errors!

Here’s what you need:  
1\. Strava account connected to Peloton account, so Peloton rides are automatically sent to Strava. You probably had this already.  
2\. Garmin Connect account connected to IRONMAN VR Club account: go to [https://app.ironmanvirtualclub.com/en/dashboard](https://app.ironmanvirtualclub.com/en/dashboard) and click “Manage my Apps”, then add Garmin Connect. Make sure you do this **before** continuing below.

Here’s how to do it:  
1\. Ride the required distance on the Peloton. I like the “Just Ride” option while watching classic hockey or baseball.  
2\. **On your computer,** go to [https://www.strava.com/athlete/training](https://www.strava.com/athlete/training) and find the Peloton ride you just completed.  
3\. Click the name of the ride (e.g. “30 minute Just Ride”). In the activity’s detail screen, click the three-dot menu and select “Export Original”.
This will download a TCX file with the same name as your ride.  

```
4. Go to [https://gotoes.org/strava/Combine_GPX_TCX_FIT_Files.php](https://gotoes.org/strava/Combine_GPX_TCX_FIT_Files.php) and upload the TCX file you just downloaded. Once you’ve uploaded the file, click the “Click Here” link to go to the download page.  
5. Use the **following options** on the download page:   
• TCX format   
• GPS Type (select your Garmin device if you have one, or pick one; **don’t select PELOTON**)   
• Activity Type: Biking   
• Use Existing Embedded Distance   
• Do Not Discard Track Points   
Then click the big blue “Combine GPS Files” button.   
This will download a new TCX file with a long series of digits in the name. You can rename it if you want.  
6. Go to [https://connect.garmin.com/modern/import-data](https://connect.garmin.com/modern/import-data) and upload the **new TCX file** you just downloaded from GOTOES. Click the blue “Import Data” button, and when it’s done, the “View Details” link.   
This will take you to the details of the activity you just uploaded. Verify it looks correct, i.e. distance and time.   
You can rename the activity from the default “Cycling” in Garmin Connect if you want.  
7. Go back to your IRONMAN VR Club dashboard [https://app.ironmanvirtualclub.com/en/dashboard](https://app.ironmanvirtualclub.com/en/dashboard) and click the green “Refresh” button.   
**Your ride should show up as an accepted activity.** The activity should show as imported from Garmin.
```

**This worked for me.** I don’t guarantee it will work for you, and it may stop working at any time. **Don’t use this technique or these tools to cheat.** This just gets us past a difficult situation; hopefully, IRONMAN and Strava work out their differences sooner rather than later. **I am not associated with IRONMAN, Strava, Garmin, or GOTOES.**

If it worked for you, consider tipping the folks at [GOTOES](https://gotoes.org/), without whose tools the exported Peloton/Strava file would not be importable into Garmin and thus accepted by the SportHeroes platform.
