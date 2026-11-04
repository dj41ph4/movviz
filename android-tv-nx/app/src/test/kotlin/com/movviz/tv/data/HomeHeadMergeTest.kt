package com.movviz.tv.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class HomeHeadMergeTest {
    private data class Item(val id: Int, val value: String = "")

    @Test fun updatesInPlaceAndAppendsNewTitles() {
        val known = listOf(Item(1), Item(2, "old"))
        assertEquals(
            listOf(Item(1), Item(2, "new"), Item(3)),
            known.mergedBy(listOf(Item(3), Item(2, "new"))) { it.id },
        )
    }

    @Test fun unchangedHeadKeepsTheSameListInstance() {
        val known = listOf(Item(1), Item(2))
        assertSame(known, known.mergedBy(listOf(Item(2))) { it.id })
        assertSame(known, known.mergedBy(emptyList()) { it.id })
    }
}
