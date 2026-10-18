package com.movviz.tv.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProfileLandingTest {
    @Test fun activeProfileIsTheLandingTile() {
        assertEquals("b", profileLandingId(listOf("a", "b", "c"), activeId = "b"))
    }

    @Test fun firstTileWhenNoActiveProfile() {
        assertEquals("a", profileLandingId(listOf("a", "b"), activeId = null))
    }

    @Test fun firstTileWhenActiveProfileIsNotShown() {
        assertEquals("a", profileLandingId(listOf("a", "b"), activeId = "z"))
    }

    @Test fun noProfileLandsOnAddTile() {
        assertNull(profileLandingId(emptyList(), activeId = "z"))
    }
}
