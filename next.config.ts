import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 + CloudFront 정적 호스팅 → 서버 없이 out/ 디렉터리로 빌드
  output: "export",
  // next/image 최적화는 서버가 필요하므로 비활성 (우리는 <img> 사용)
  images: { unoptimized: true },
  // /schedule → /schedule/index.html 로 매핑되게 (S3 정적 호스팅 호환)
  trailingSlash: true,
};

export default nextConfig;
