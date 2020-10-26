module.exports = {
    parse: (params, sep = '=', paramSep = ',') => {
        if (typeof params === 'string') params = params.split(paramSep)
        const ret = {}
        params && params.forEach(x => {
            const kv = x.split(sep)
            if (kv.length === 2) {
                ret[kv[0]] = kv[1]
            }
        })
        return ret
    },
    stringify: (params, sep = '=', paramSep = ' ') => {
        return Object.keys(params).map(key => `${key}${sep}${params[key]}`).join(paramSep)
    }
}