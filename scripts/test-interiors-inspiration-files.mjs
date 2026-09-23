import assert from 'node:assert/strict'
import {
  MAX_INSPIRATION_IMAGES,
  MAX_PROJECT_FILE_SIZE_BYTES,
  isValidInspirationFileState,
  selectInspirationFiles,
} from '../src/lib/interiorsInspirationFiles.ts'

function image(index, overrides = {}) {
  return {
    name: `inspiracija-${index}.jpg`,
    size: 1024,
    lastModified: index,
    type: 'image/jpeg',
    ...overrides,
  }
}

const one = selectInspirationFiles([], [image(1)])
assert.equal(one.files.length, 1)

const exactlyFive = selectInspirationFiles(
  [],
  Array.from({ length: MAX_INSPIRATION_IMAGES }, (_, index) => image(index)),
)
assert.equal(exactlyFive.files.length, 5)
assert.equal(exactlyFive.rejections.overLimit.length, 0)

const sixAtOnce = selectInspirationFiles(
  [],
  Array.from({ length: 6 }, (_, index) => image(index)),
)
assert.equal(sixAtOnce.files.length, 5)
assert.equal(sixAtOnce.rejections.overLimit.length, 1)

const threeThenFour = selectInspirationFiles(
  [image(1), image(2), image(3)],
  [image(4), image(5), image(6), image(7)],
)
assert.equal(threeThenFour.files.length, 5)
assert.equal(threeThenFour.rejections.overLimit.length, 2)

const fourThenThree = selectInspirationFiles(
  [image(1), image(2), image(3), image(4)],
  [image(5), image(6), image(7)],
)
assert.equal(fourThenThree.files.length, 5)
assert.equal(fourThenThree.rejections.overLimit.length, 2)

const afterRemoval = fourThenThree.files.filter((_, index) => index !== 2)
assert.equal(afterRemoval.length, 4)
const afterReAdd = selectInspirationFiles(afterRemoval, [image(8)])
assert.equal(afterReAdd.files.length, 5)
assert.equal(afterReAdd.rejections.overLimit.length, 0)

const duplicate = selectInspirationFiles([image(1)], [image(1)])
assert.equal(duplicate.files.length, 1)
assert.equal(duplicate.rejections.duplicate.length, 1)

const unsupported = selectInspirationFiles(
  [],
  [image(1, { name: 'inspiracija.gif', type: 'image/gif' })],
)
assert.equal(unsupported.files.length, 0)
assert.equal(unsupported.rejections.unsupportedType.length, 1)

const oversized = selectInspirationFiles(
  [],
  [image(1, { size: MAX_PROJECT_FILE_SIZE_BYTES + 1 })],
)
assert.equal(oversized.files.length, 0)
assert.equal(oversized.rejections.oversized.length, 1)

assert.equal(isValidInspirationFileState(exactlyFive.files), true)
assert.equal(
  isValidInspirationFileState([
    ...exactlyFive.files,
    image(20),
  ]),
  false,
)
assert.equal(
  isValidInspirationFileState([
    image(1),
    image(1),
  ]),
  false,
)

console.log('Interiors inspiration file checks passed.')
