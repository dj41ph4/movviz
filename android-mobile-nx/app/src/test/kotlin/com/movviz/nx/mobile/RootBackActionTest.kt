package com.movviz.nx.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class RootBackActionTest {
    @Test fun openSearchClosesFirstOnAnyTab() {
        assertEquals(RootBackAction.CloseSearch, rootBackAction(searchOpen = true, onHomeTab = true))
        assertEquals(RootBackAction.CloseSearch, rootBackAction(searchOpen = true, onHomeTab = false))
    }

    @Test fun otherTabReturnsToHome() {
        assertEquals(RootBackAction.GoHome, rootBackAction(searchOpen = false, onHomeTab = false))
    }

    @Test fun homeAsksForASecondPress() {
        assertEquals(RootBackAction.ArmExit, rootBackAction(searchOpen = false, onHomeTab = true))
    }
}
