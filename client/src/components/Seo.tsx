// =============================================================================
// <Seo> — per-route meta via react-helmet-async (T21h). Emits a unique title,
// description, canonical, and OpenGraph/Twitter tags. Works both in the browser
// (updates the document head on navigation) and during the SSR prerender (helmet
// collects the tags into the built HTML so crawlers see them without running JS).
// =============================================================================
import { Helmet } from "react-helmet-async";
import { absoluteUrl, OG_IMAGE, SITE_URL } from "../lib/seo";

interface SeoProps {
    title: string;
    description: string;
    /** Route path for canonical + og:url, e.g. "/pricing". */
    path: string;
    /** Optional override for the social image (defaults to og-image.png). */
    image?: string;
}

const Seo = ({ title, description, path, image = OG_IMAGE }: SeoProps) => {
    const url = absoluteUrl(path);
    const imageUrl = image.startsWith("http") ? image : SITE_URL + image;
    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Onyx" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={url} />
            <meta property="og:image" content={imageUrl} />

            {/* Twitter / X */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />
        </Helmet>
    );
};

export default Seo;
