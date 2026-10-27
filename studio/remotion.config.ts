import { Config } from "@remotion/cli/config"

Config.setVideoImageFormat("jpeg")
Config.setOverwriteOutput(true)
// On an M-series Mac, 4, 6, 8 and 10 threads all rendered in about the same time, so more does not pay.
Config.setConcurrency(4)
Config.setColorSpace("bt709")
// Each video brings its own public dir (--public-dir=videos/<KEY>/media); EXAMPLE is the default.
Config.setPublicDir("videos/EXAMPLE/media")
