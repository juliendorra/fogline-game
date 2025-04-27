# recommanded settings for generating cards

deno run --allow-read --allow-write generate_terrain_cards.ts --iconSize=100

deno run --allow-read --allow-write --allow-net generate_unit_cards.ts --marginVertical=100 --fontSizeName=26 --fontSizeStats=34 --marginHorizontal=40 --unitImageHeight=100

deno run --allow-read --allow-write --allow-net compress_images.ts

deno run --allow-read --allow-write --allow-net generate_print_sheets.ts