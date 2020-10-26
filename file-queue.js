let _fileLoader, _files, _queue

const init = (fileLoader, queue) => {
    _fileLoader = fileLoader
    _files = {}
    _queue = queue
}

const loadNext = () => {
    const file = _queue.shift()
    if (_files[file] === undefined) {
        _files[file] = _fileLoader(file)
    }
    const contents = _files[file]
    if (!_queue.includes(file)) {
        delete _files[file]
    }
    return contents
}

module.exports = { init, loadNext }