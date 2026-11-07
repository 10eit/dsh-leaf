import Foundation
import PDFKit
import AppKit

struct Word: Codable { let text: String; let x: Double; let y: Double; let w: Double; let h: Double }
struct PageText: Codable { let page: Int; let pages: Int; let width: Double; let height: Double; let words: [Word] }

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(2)
}

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[2])) else {
    fail("usage: pdfhelper text|render <pdf> [page] [out.png] [scale]")
}
let command = args[1]

if command == "text" {
    let pageNumber = args.count > 3 ? (Int(args[3]) ?? 1) : 1
    guard pageNumber >= 1, pageNumber <= doc.pageCount, let page = doc.page(at: pageNumber - 1) else {
        fail("page out of range")
    }
    let bounds = page.bounds(for: .mediaBox)
    let text = page.string ?? ""
    let ns = text as NSString
    var words: [Word] = []
    var current = ""
    var box: NSRect? = nil
    var previous: NSRect? = nil
    let whitespace = CharacterSet.whitespacesAndNewlines

    func flush() {
        if current.isEmpty || box == nil { current = ""; box = nil; previous = nil; return }
        let b = box!
        words.append(Word(
            text: current,
            x: Double(b.minX),
            y: Double(bounds.height - b.maxY),
            w: Double(b.width),
            h: Double(b.height)
        ))
        current = ""
        box = nil
        previous = nil
    }

    for index in 0..<ns.length {
        let scalar = ns.character(at: index)
        guard let unicode = UnicodeScalar(scalar) else { continue }
        if whitespace.contains(unicode) {
            flush()
            continue
        }
        let charBounds = page.characterBounds(at: index)
        if charBounds.width <= 0.1 || charBounds.height <= 0.1 {
            flush()
            continue
        }
        if let last = previous {
            let lineBreak = abs(charBounds.midY - last.midY) > max(charBounds.height, last.height) * 0.6
            let gap = charBounds.minX - last.maxX
            let bigGap = gap > max(charBounds.height, last.height) * 0.9 || gap < -max(charBounds.height, last.height) * 1.5
            if lineBreak || bigGap { flush() }
        }
        current += ns.substring(with: NSRange(location: index, length: 1))
        box = box == nil ? charBounds : box!.union(charBounds)
        previous = charBounds
    }
    flush()
    let payload = PageText(page: pageNumber, pages: doc.pageCount, width: Double(bounds.width), height: Double(bounds.height), words: words)
    let encoder = JSONEncoder()
    if let data = try? encoder.encode(payload), let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        fail("failed to encode")
    }
} else if command == "render" {
    guard args.count >= 5 else { fail("render needs page and output") }
    let pageNumber = Int(args[3]) ?? 1
    let output = args[4]
    let scale = args.count > 5 ? (Double(args[5]) ?? 2) : 2
    guard pageNumber >= 1, pageNumber <= doc.pageCount, let page = doc.page(at: pageNumber - 1) else {
        fail("page out of range")
    }
    let bounds = page.bounds(for: .mediaBox)
    let size = NSSize(width: bounds.width * scale, height: bounds.height * scale)
    let image = page.thumbnail(of: size, for: .mediaBox)
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        fail("failed to render")
    }
    try png.write(to: URL(fileURLWithPath: output))
} else {
    fail("unknown command")
}
