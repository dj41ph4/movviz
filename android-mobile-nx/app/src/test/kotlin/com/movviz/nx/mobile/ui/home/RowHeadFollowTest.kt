package com.movviz.nx.mobile.ui.home

import org.junit.Assert.assertEquals
import org.junit.Test

class RowHeadFollowTest {
    @Test fun rowAtStartReturnsToTheNewHead() {
        assertEquals(true, shouldReturnToRowHead(previousHead = "one", head = "new", wasAtStart = true))
    }

    @Test fun rowSwipedFurtherStaysWhereItIs() {
        assertEquals(false, shouldReturnToRowHead(previousHead = "one", head = "new", wasAtStart = false))
    }

    @Test fun unchangedHeadNeverMovesTheRow() {
        assertEquals(false, shouldReturnToRowHead(previousHead = "one", head = "one", wasAtStart = true))
    }

    @Test fun firstCompositionAndEmptyRowHaveNothingToFollow() {
        assertEquals(false, shouldReturnToRowHead(previousHead = null, head = "one", wasAtStart = true))
        assertEquals(false, shouldReturnToRowHead(previousHead = "one", head = null, wasAtStart = true))
    }
}
