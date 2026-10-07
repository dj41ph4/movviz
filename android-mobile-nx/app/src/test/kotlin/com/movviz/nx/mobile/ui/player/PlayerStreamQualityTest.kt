package com.movviz.nx.mobile.ui.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class PlayerStreamQualityTest {
    @Test fun unknownFormatsDoNotInventQuality() {
        val quality = detectedStreamQuality()
        assertEquals(emptyList<String>(), quality.video)
        assertEquals(emptyList<String>(), quality.audio)
    }

    @Test fun widescreenFilmKeepsItsActualResolutionTier() {
        val quality = detectedStreamQuality(3840, 1608, "video/hevc", "HDR10", "audio/eac3", 6)
        assertEquals(listOf("4K", "HDR10", "HEVC"), quality.video)
        assertEquals(listOf("EAC3", "5.1"), quality.audio)
        assertFalse(quality.audio.contains("Atmos"))
    }

    @Test fun transcodedStreamDisplaysItsCurrentFormats() {
        val quality = detectedStreamQuality(1280, 720, "video/avc", audioMime = "audio/mp4a-latm", channels = 2)
        assertEquals(listOf("720p", "AVC"), quality.video)
        assertEquals(listOf("AAC", "2.0"), quality.audio)
    }

    @Test fun atmosRequiresAnExplicitJocFormat() {
        assertEquals(listOf("EAC3", "5.1", "Atmos"), detectedStreamQuality(audioMime = "audio/eac3-joc", channels = 6).audio)
        assertEquals(listOf("TrueHD", "7.1"), detectedStreamQuality(audioMime = "audio/true-hd", channels = 8).audio)
    }

    @Test fun unknownCodecDoesNotHideDetectedDimensionsOrChannels() {
        val quality = detectedStreamQuality(1920, 800, "video/unknown", audioMime = "audio/unknown", channels = 2)
        assertEquals(listOf("1080p"), quality.video)
        assertEquals(listOf("2.0"), quality.audio)
    }
}
