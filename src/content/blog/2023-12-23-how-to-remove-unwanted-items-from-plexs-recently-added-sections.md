---
title: "How to remove unwanted items from Plex’s “Recently Added” sections"
date: 2023-12-23
description: "I added a movie in 2019 but it’s showing as Recently Added. Annoying!"
tags: ["blog", "tech"]
mediumUrl: "https://medium.com/@smartwatermelon/how-to-remove-unwanted-items-from-plexs-recently-added-sections-a1bc7f34083f"
---

### How to remove unwanted items from Plex’s “Recently Added” sections

There’s a lot of conflicting and outdated information on this topic. With my typical combination of hyperfocus, trial-and-error, and a lot of swearing, I’ve worked out the current procedure _(December 2023, PMS version 1.40.0.7775, macOS, YMMV)_.

![Person frustrated at a computer screen](/images/blog/yzzDK3H9FP9r5YI_ZsbbBw.jpeg)
_Photo by [Sigmund](https://unsplash.com/@sigmund?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash) on [Unsplash](https://unsplash.com/photos/woman-in-black-shirt-sitting-beside-black-flat-screen-computer-monitor-Im_cQ6hQo10?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash)_

#### Why do I need this?

You need this if your Plex dashboard’s “Recently Added Movies” (or TV Shows) section suddenly shows items you added months or years ago. PMS doesn’t offer a way to flag an item as “not recently added” or “don’t show this in the Recently Added section.”

#### Do I need to be an expert hacker?

You need to be comfortable with the macOS Terminal. I’ll give you some copy-and-paste commands to use, but just be aware this is not for the beginner.

#### Will you fix my Plex and/or Mac if I break it?

No.

1. Stop PMS. Click and hold the Plex icon in the Mac's Dock and select Quit.
2. Back up your database and settings. [Here is guidance from Plex](https://support.plex.tv/articles/201539237-backing-up-plex-media-server-data/) on how to do this. In current versions of PMS on macOS, the database is at:  

```
    `/System/Volumes/Data/Users/$USER/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
3.  Launch Terminal and open the Plex database in Plex’s custom SQLite3:  
    `$ /Applications/Plex\ Media\ Server.app/Contents/MacOS/Plex\ SQLite “/System/Volumes/Data/Users/$USER/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db”`
4.  Find the offending item (substitute a word in the title for TITLE here):  
    `sqlite> select title from metadata_items where title like ‘%TITLE%’;`
5.  You’ll see a response showing the title(s) matching your query. Look at the `added_at` timestamp to confirm this is the issue. It should show something much more recent than when the item was actually added, possibly even a future date/time.  
    `sqlite> select datetime(added_at, ‘unixepoch’, ‘localtime’) from metadata_items where title like ‘%TITLE%’;`
6.  Figure out what timestamp you want the item(s) to have. For mine, I just wanted the `added_at` timestamp to be the same as the file date (i.e., when I acquired the file and added it to Plex in the first place). You can use [EpochConverter](https://www.epochconverter.com/) for this. For example, January 20, 2021, at noon EST, is `1611162000` in Unix Epoch time.
7.  Fix the `added_at` timestamp on the problem item(s).  
    *** WARNING: THIS WRITES TO YOUR PLEX DATABASE. IF YOU TYPO IT, OR THERE’S A NETWORK INTERRUPTION WHILE THE CHANGE IS BEING WRITTEN, OR YOUR CAT JUMPS ON THE KEYBOARD AT THE WRONG SECOND, THERE COULD BE BAD CONSEQUENCES. DID YOU BACK UP YOUR DATABASE? ***  
    `sqlite> update metadata_items set added_at = ‘TIMESTAMP’ where title like ‘%TITLE%’;`
8.  Double-check that the `added_at` timestamp is now correct:  
    `sqlite> select datetime(added_at, ‘unixepoch’, ‘localtime’) from metadata_items where title like ‘%TITLE%’;`
9.  Exit SQLite3 with `.quit`, and launch Plex. You should re-scan the Movies library. Check the “Recently Added” section. The item(s) you fixed should no longer be present.
```

Good luck! Feel free to comment about whether this helped. Again, though, I can’t offer technical support. Make sure to back up your database!

Sources:

```
-   [https://www.reddit.com/r/PleX/comments/ml98am/how_do_i_fix_recently_added_being_stuck_due_to/](https://www.reddit.com/r/PleX/comments/ml98am/how_do_i_fix_recently_added_being_stuck_due_to/)
-   [https://web.archive.org/web/20230208003624/https://getsysadminblog.com/2019/09/30/plex-fix-stuck-items-in-the-recently-added-dashboards/](https://web.archive.org/web/20230208003624/https://getsysadminblog.com/2019/09/30/plex-fix-stuck-items-in-the-recently-added-dashboards/)
-   [https://michielvanerp.wordpress.com/2021/08/22/plex-fix-recently-added/](https://michielvanerp.wordpress.com/2021/08/22/plex-fix-recently-added/)
-   [https://support.plex.tv/articles/202915258-where-is-the-plex-media-server-data-directory-located/](https://support.plex.tv/articles/202915258-where-is-the-plex-media-server-data-directory-located/)
-   [https://www.epochconverter.com/](https://www.epochconverter.com/)
-   [https://support.plex.tv/articles/201539237-backing-up-plex-media-server-data/](https://support.plex.tv/articles/201539237-backing-up-plex-media-server-data/)
```

![Cat sitting next to a laptop computer](/images/blog/QR34Iq_tJAZOZ-rZCpgiWA.jpeg)
_Photo by [Dillon Kydd](https://unsplash.com/@kyddvisuals?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash) on [Unsplash](https://unsplash.com/photos/a-cat-sitting-on-top-of-a-desk-next-to-a-laptop-computer-9XrdePyTewE?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash)_
