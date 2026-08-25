// 이미지 속 글자 회수 — 애플 Vision(로컬·무료·한국어). macOS 13+ 필요.
//   빌드: swiftc -O ocr-text.swift -o ocr-text
//   사용: ./ocr-text a.jpg b.jpg ...      → 이미지 1장당 JSON 한 줄(JSONL)
//
// 출력 필드 중 `sentences` = 한글 15자 넘는 줄의 개수.
//   ⭐이게 게이트다: sentences >= 2 면 「문장」, 아니면 「조각」(지도·메뉴판·가격표·로고).
//   ⛔conf(신뢰도)로 거르지 마라 — 2026-08-25 실측에서 같은 0.73에
//     쓸 만한 소개글과 포스터 날짜 조각이 같이 있었다(안 갈린다).
import Foundation
import Vision
import AppKit

func jsonStr(_ s: String) -> String {
    let d = try! JSONSerialization.data(withJSONObject: [s])
    var t = String(data: d, encoding: .utf8)!
    t.removeFirst(); t.removeLast()
    return t
}
func hangul(_ s: String) -> Int {
    s.unicodeScalars.filter { $0.value >= 0xAC00 && $0.value <= 0xD7A3 }.count
}

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
    FileHandle.standardError.write("usage: ocr-text <image>...\n".data(using: .utf8)!)
    exit(1)
}

for path in paths {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("{\"file\":\(jsonStr(path)),\"error\":\"load_failed\"}")
        continue
    }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.usesLanguageCorrection = true
    do {
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        var lines: [String] = [], confs: [Double] = []
        for obs in (req.results ?? []) {
            guard let top = obs.topCandidates(1).first else { continue }
            lines.append(top.string); confs.append(Double(top.confidence))
        }
        let text = lines.joined(separator: "\n")
        let avg = confs.isEmpty ? 0 : confs.reduce(0, +) / Double(confs.count)
        let sentences = lines.filter { hangul($0) >= 15 }.count
        print("{\"file\":\(jsonStr(path)),\"lines\":\(lines.count),\"hangul\":\(hangul(text))," +
              "\"sentences\":\(sentences),\"conf\":\(String(format: "%.2f", avg)),\"text\":\(jsonStr(text))}")
    } catch {
        print("{\"file\":\(jsonStr(path)),\"error\":\"ocr_failed\"}")
    }
}
