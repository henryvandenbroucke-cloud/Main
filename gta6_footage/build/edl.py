# Edit decision list: (timeline_start, source, source_in_seconds, crop_x_center 0..1, note)
# Timeline end of each shot = start of the next. Last shot ends at END.
# Every in-point sits inside one source scene (see cat/scenes.json), so no shot contains a hard cut.
T1, T2, LT, EL = "GTAVI_Trailer_1", "GTAVI_Trailer_2", "GTAVI_Launch_Trailer", "GTAVI_An_Extended_Look"
SHOTS = [
    # It took Rockstar over twelve years... but GTA 6 is finally here.
    (0.00, T1, 2.75, 0.50, "sunset over Vice City highway"),          # 2.67-5.00
    (2.20, T2, 140.10, 0.70, "jet ski"),                              # 140.03-141.83
    (3.40, T1, 23.30, 0.55, "speedboat in the harbour"),              # 23.27-24.83
    # Its very first trailer pulled more than sixty million views in just twelve hours.
    (4.60, T1, 21.75, 0.50, "packed beach crowd"),                    # 21.73-23.27
    (6.10, T1, 35.70, 0.50, "aerial bridge over the ocean"),          # 35.67-37.43
    (7.80, T1, 37.55, 0.45, "balcony over the city"),                 # 37.43-39.80
    # The biggest video launch in YouTube history at the time.
    (9.50, T1, 32.58, 0.40, "neon street, sports cars"),              # 32.57-34.13
    (11.05, T1, 24.90, 0.50, "night highway, neon"),                  # 24.83-27.43
    # This time we're in Leonida, Rockstar's version of Florida, with a fully reimagined Vice City.
    (12.70, T2, 5.78, 0.50, "aerial Keys islands"),                   # 0.17-8.13
    (15.00, T2, 34.65, 0.55, "driving highway into the city"),        # 34.60-38.37
    (17.00, T1, 30.05, 0.50, "Vice City at night from above"),        # 30.00-32.57
    # Neon nights, packed beaches, swamps, highways and small towns, all in one map.
    (19.00, T1, 28.99, 0.50, "neon club"),                            # 28.97-30.00
    (20.00, T1, 12.00, 0.50, "beach aerial"),                         # 10.93-18.37
    (21.20, T1, 19.90, 0.50, "flamingos in the swamp"),               # 19.17-21.73
    (22.40, LT, 2.80, 0.50, "highway, towing a boat"),                # 2.67-6.97
    (23.40, T2, 8.20, 0.45, "stilt house small town"),                # 8.13-9.80
    # And for the first time, there are two leads. Jason and Lucia.
    (24.30, LT, 26.38, 0.45, "Jason and Lucia in car"),               # 26.37-27.83
    (25.75, T2, 88.24, 0.45, "Jason and Lucia in kitchen"),           # 88.23-89.50
    (27.00, T2, 79.60, 0.50, "Jason and Lucia at the bar"),           # 79.50-81.40
    # A criminal couple pulled into the Leonida underworld after a heist goes wrong.
    (27.80, T1, 68.68, 0.45, "masked robbery"),                       # 68.67-70.27
    (29.35, LT, 60.00, 0.55, "shootout"),                             # 59.90-63.17
    (30.80, LT, 72.78, 0.40, "Lucia firing"),                         # 72.77-73.80
    (31.80, T2, 117.95, 0.50, "car explosion"),                       # 117.93-118.83
    # Bonnie and Clyde energy.
    (32.50, T1, 76.52, 0.55, "running out with the loot"),            # 76.50-~77.6
    (33.50, LT, 67.20, 0.50, "embrace on the balcony"),               # 67.07-68.53
    # The detail is insane.
    (34.30, T2, 38.45, 0.50, "beach gym crowd"),                      # 38.37-41.60
    # Crowds that react to everything, social media chaos filmed in-game, and a world that feels alive every second.
    (36.10, EL, 592.00, 0.55, "rooftop crowd gameplay"),
    (38.00, T1, 43.92, 0.46, "in-game social media video"),           # 43.90-45.47
    (39.55, T1, 57.40, 0.50, "in-game phone video"),                  # 57.33-59.53
    (41.40, EL, 748.00, 0.50, "city skyline with helicopter"),        # cut at ~750.17
    # So... are you playing Jason or Lucia first?
    (43.50, LT, 12.00, 0.55, "Jason on the phone"),                   # 11.90-14.20
    (45.10, T1, 62.54, 0.55, "Lucia in car"),                         # 62.53-63.57
    (46.05, LT, 63.20, 0.50, "Lucia at sunset"),                      # 63.17-64.03
    # Tell me in the comments.
    (46.60, T2, 98.48, 0.50, "Jason and Lucia holding hands"),        # 98.47-99.67
    (47.80, T1, 73.00, 0.50, "Jason and Lucia, lamp light"),          # 72.83-76.50
    (48.30, T1, 83.60, 0.50, "GTA VI logo, out now"),                 # 76.50-90.03
]
END = 50.40
