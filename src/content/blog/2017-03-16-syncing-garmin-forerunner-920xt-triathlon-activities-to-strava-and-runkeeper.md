---
title: "Syncing Garmin Forerunner 920XT Triathlon activities to Strava and Runkeeper"
date: 2017-03-16
description: "The Garmin Forerunner 920XT is a terrific triathlon watch, and I really like the tri mode — where you just hit the Lap key in between…"
tags: ["blog", "tech", "triathlon"]
mediumUrl: "https://medium.com/@smartwatermelon/syncing-garmin-920xt-triathlon-activities-to-strava-and-runkeeper-a4d3ca34d344"
---

### Syncing Garmin Forerunner 920XT Triathlon activities to Strava and Runkeeper

![Garmin Forerunner 920XT triathlon watch](/images/blog/CXet_jzxO0WXdBx_4FEylg.png)
*Garmin Forerunner 920XT (image courtesy Garmin)*

The [Garmin Forerunner 920XT](https://buy.garmin.com/en-US/US/p/137024) is a terrific triathlon watch, and I really like the tri mode — where you just hit the *Lap* key in between segments (T1, run start, T2, bike start) and when you’re done, it creates a single “Triathlon” activity in [Garmin Connect](https://connect.garmin.com/en-US/).

I use a Web service called [Tapiriik](https://tapiriik.com/) to automatically sync my workouts and races from Connect to [Strava](https://www.strava.com/) and [Runkeeper](https://runkeeper.com/home). Garmin actually has a built-in [Strava sync](https://support.strava.com/hc/en-us/articles/216918057-Uploading-from-a-Garmin-device-), but I find that it only works around half the time.

Unfortunately, the other services don’t understand the Triathlon activity. Strava doesn’t have a multi-segment activity at all, and while Runkeeper does support an “Other” category, swims/bikes/runs recorded within an “Other” don’t actually show up within their respective category (which means they don’t count toward my annual goals!).

So here’s how I resolve that problem, because tracking these individual segments is more important to me than recording the total time as a single activity. I should note that I have no connection to any company or service mentioned here, though I did receive my Forerunner 920XT as a contest prize in 2015.

Step 1: Triathlon! Use the Forerunner 920XT’s Triathlon mode. Hit *Lap* in between segments. When you’re done (**congratulations!**), sync to Garmin Connect. I use the [Connect](https://itunes.apple.com/us/app/garmin-connect-mobile/id583446403?mt=8) app on my iPhone, but you could also do a wired sync to your computer.

Step 2: Let Tapiriik and/or Garmin’s built-in Strava sync do their thing. Your triathlon activity will show up in Strava as five separate activities (swim, T1, bike, T2, run).

Step 3: In your Strava dashboard, set the activity types for each segment. Strava doesn’t have “Swim to Bike” or “Bike to Run” so I use the generic “Workout” activity type for transitions. This is a good time to name the activity segments as well.

Step 4: In your Strava dashboard, export each activity segment to GPX. (It’s under the wrench icon). This is where naming the activities comes in handy, because the GPX files will be downloaded using those names.

Step 5: In Garmin Connect, import the five GPX files you just exported from Strava. You can use the bulk import mode to get them all at once, but you’ll need to adjust the name and activity type because that information isn’t saved with the GPX format. Garmin even has “swim to bike transition” and “bike to run transition” activity types. Once you’ve done this and have individual activities in Garmin Connect, you can delete the original multi-segment activity.

Step 6 (optional): If you use Runkeeper, import the five GPX files and give them appropriate name and activity types. Runkeeper doesn’t have a “Transition” activity type, so I use “Other”.

You’re done! And now, in Garmin Connect and Strava (and perhaps Runkeeper) you have the saved activity records for each segment of your huge triathlon achievement. You can look at your swim, your T1 time (my perennial weakness) and even the GPS tracks for your transitions — yup, those quick bathroom dashes show up — and the swim, bike, and run will count toward your defined goals if you have any.
