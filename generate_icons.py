#!/usr/bin/env python3
"""
Generate PWA icons for ethniCity brand.
Creates PNG icons with circular gradient background and "eC" text.
"""

from PIL import Image, ImageDraw
import os

# Brand colors
TEAL = (26, 122, 122)  # #1a7a7a
ORANGE = (201, 104, 48)  # #c96830
DARK_TEAL = (13, 79, 90)  # #0d4f5a
WHITE = (255, 255, 255)

def create_gradient_circle(width, height):
    """Create a circular gradient image from teal to orange."""
    # Create a new image with RGBA mode for transparency
    img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    pixels = img.load()
    
    center_x = width / 2
    center_y = height / 2
    max_radius = max(width, height) / 2
    
    # Draw gradient circle
    for x in range(width):
        for y in range(height):
            # Calculate distance from center
            dx = x - center_x
            dy = y - center_y
            distance = (dx * dx + dy * dy) ** 0.5
            
            # Only fill within the circle
            if distance <= max_radius:
                # Calculate ratio for gradient (0 to 1)
                ratio = distance / max_radius
                
                # Interpolate between TEAL and ORANGE
                r = int(TEAL[0] * (1 - ratio) + ORANGE[0] * ratio)
                g = int(TEAL[1] * (1 - ratio) + ORANGE[1] * ratio)
                b = int(TEAL[2] * (1 - ratio) + ORANGE[2] * ratio)
                
                pixels[x, y] = (r, g, b, 255)
    
    return img

def add_text_centered(img, text, font_size):
    """Add centered text to an image."""
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fall back to default if not available
    try:
        from PIL import ImageFont
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    width, height = img.size
    
    # Get text bounding box to center it properly
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) / 2
    y = (height - text_height) / 2
    
    # Draw text in white
    draw.text((x, y), text, fill=WHITE, font=font)
    
    return img

def generate_icon(size, output_path):
    """Generate a single icon of specified size."""
    print(f"Generating {size}x{size} icon...")
    
    # Create gradient background
    img = create_gradient_circle(size, size)
    
    # Add "eC" text
    font_size = int(size * 0.4)
    img = add_text_centered(img, "eC", font_size)
    
    # Save the icon
    img.save(output_path, 'PNG')
    print(f"  Saved to {output_path}")

def main():
    """Generate all required PWA icons."""
    output_dir = "/sessions/serene-inspiring-sagan/mnt/outputs/sangam-pwa/public"
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate icons
    print("Generating ethniCity PWA Icons")
    print("=" * 50)
    
    icons = [
        (192, os.path.join(output_dir, "icon-192.png")),
        (512, os.path.join(output_dir, "icon-512.png")),
        (180, os.path.join(output_dir, "apple-touch-icon.png")),
    ]
    
    for size, path in icons:
        generate_icon(size, path)
    
    print("=" * 50)
    print("All icons generated successfully!")

if __name__ == "__main__":
    main()
